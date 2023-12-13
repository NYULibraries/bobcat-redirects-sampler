import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'process';
import { fileURLToPath } from 'url';

import glob from 'glob';
import playwright from 'playwright';
import { createLogger, format, transports } from 'winston';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
    BobcatRedirectsServiceSampler
} from './lib/classes/BobcatRedirectsServiceSampler.js';
import {
    BobcatPrimoClassicServiceSampler
} from './lib/classes/BobcatPrimoClassicServiceSampler.js';

// https://stackoverflow.com/questions/64383909/dirname-is-not-defined-in-node-14-version
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

// https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
// See "Option 2: Leverage the CommonJS require function to load JSON files"
import { createRequire } from 'module';

const require = createRequire( import.meta.url );

const ROOT_DIR = __dirname;

// Top-level directories
const LOGS_DIR = path.join( ROOT_DIR, 'logs' );
const RESPONSE_SAMPLES_DIR = path.join( ROOT_DIR, 'response-samples' );
const SCREENSHOTS_DIR = path.join( ROOT_DIR, 'screenshots' );
const TEST_CASE_FILES_DIR = path.join( ROOT_DIR, 'test-case-files' );

// Test case groups
const TEST_CASE_GROUPS = fs.readdirSync( TEST_CASE_FILES_DIR );

// Files
const INDEX_FILE_NAME = 'index.json';

// Number of seconds to wait between requests
const DEFAULT_SLEEP = 0;

// 5 minutes
const DEFAULT_TIMEOUT = 300_000;

const logger = createLogger(
    {
        level      : 'info',
        format     : format.combine(
            format.timestamp( {
                                  format : 'YYYY-MM-DD HH:mm:ss'
                              } ),
            format.printf( info => `${info.timestamp} ${info.level}: ${info.message}` ),
        ),
        transports : [
            new transports.Console(),
            //
            // - Write all logs with importance level of `error` or less to `error.log`
            // - Write all logs with importance level of `info` or less to `combined.log`
            //
            new transports.File( {
                                     filename : `${LOGS_DIR}/error.log`,
                                     level    : 'error'
                                 } ),
            new transports.File( { filename : `${LOGS_DIR}/combined.log` } ),
        ],
    } );

let index;
let indexFile;
let testCaseGroup;
let testCasePaths;

// Playwright
let browser;
let headed = false;
let page;

async function fetchResponseHtml( sampler, path, key ) {
    const url = `${sampler.endpoint}${path}`;

    let html;
    try {
        html = await sampler.fetchSampleHtml( url );
    } catch ( error ) {
        logger.error( `${path} | ${url}: ${error}` );
        return;
    }

    return html;
}

async function fetchResponseSamples( samplers ) {
    for ( let i = 0; i < testCasePaths.length; i++ ) {
        const testCasePath = testCasePaths[ i ];
        const key = getKey( testCasePath );

        const indexEntry = {
            key,
            testCaseGroup,
            fetchTimestamp : new Date( Date.now() ).toLocaleString( 'en-US', {
                timeZone : 'America/New_York',
            } ),
            sampleFiles    : {},
            screenshots    : {},
        };

        let failed = false;
        let html = {};
        // Fetch response HTML for each service
        for ( let i = 0; i < samplers.length; i++ ) {
            const sampler = samplers[ i ];
            const responseHtml = await fetchResponseHtml( sampler, testCasePath, key );
            if ( responseHtml ) {
                indexEntry.sampleFiles[ sampler.serviceName ] = sampler.getServiceResponseSampleFilePathRelative( key );
                html[ sampler.serviceName ] = responseHtml;
            } else {
                failed = true;
                logger.error( `${testCasePath}: failed to fetch response for ${sampler.name}` );

                try {
                    const screenshotFile = path.join( SCREENSHOTS_DIR, sampler.getServiceResponseScreenshotFilePathRelative( key ) );
                    await page.screenshot( { path : screenshotFile } );
                    logger.error( `${testCasePath}: saved screenshot file ${screenshotFile}` );
                } catch ( e ) {
                    logger.error( `${testCasePath}: error saving screenshot file ${screenshotFile}: ${e}` );
                }
            }
        }

        // Write out sample files
        let sampleFileSaveError = false;
        Object.keys( indexEntry.sampleFiles ).forEach( serviceName => {
            const sampleFile = indexEntry.sampleFiles[ serviceName ];
            const serviceResponseSampleFilePathAbsolute = path.join( RESPONSE_SAMPLES_DIR, sampleFile );
            try {
                if ( !fs.existsSync( path.dirname( serviceResponseSampleFilePathAbsolute ) ) ) {
                    fs.mkdirSync( path.dirname( serviceResponseSampleFilePathAbsolute ), { recursive : true } );
                }
                fs.writeFileSync( serviceResponseSampleFilePathAbsolute, html[ serviceName ], { encoding : 'utf8' } );
            } catch ( error ) {
                logger.error( `${testCasePath}: failed to write sample file ${serviceResponseSampleFilePathAbsolute}: ${error}` );

                sampleFileSaveError = true;
            }
        } );

        if ( sampleFileSaveError ) {
            logger.error( `${testCasePath}: test group sample directory might be in an inconsistent state` );
        }

        if ( ! failed ) {
            logger.info( `${testCasePath}: fetched responses: ${samplers.map( sampler => sampler.name ).join( ', ' )}` );
        }

        // Update index
        index[ testCasePath ] = indexEntry;
        writeIndex();

        sleepSeconds( DEFAULT_SLEEP );
    }
}

function getIndex() {
    const index = {};
    if ( fs.existsSync( indexFile ) ) {
        const indexFileJson = require( indexFile );
        Object.assign( index, indexFileJson );
    }

    return index;
}

function getKey( link ) {
    return link.substring( 1 ).replaceAll( '/', '--' );
}

function getTestCasePaths() {
    const testCaseUrls = [];
    const directory = path.join( TEST_CASE_FILES_DIR, testCaseGroup );
    const testCaseFiles = glob.sync( `${directory}/**/*.txt` );

    testCaseFiles.forEach( testCaseFile => {
        const lines = fs.readFileSync( testCaseFile, 'utf-8' );
        lines.split( /\r?\n/ ).forEach( line => {
            if ( line.match( new RegExp( '^https?://bobcat.library.nyu.edu/permalink.*/' ) ) ) {
                const path = new URL( line ).pathname;
                testCaseUrls.push( path );
            }
        } );
    } );

    testCaseUrls.sort();

    return testCaseUrls;
}

async function initializePlaywright( timeoutOption ) {
    browser = await playwright.chromium.launch(
        {
            headless : !headed,
        }
    );

    page = await browser.newPage(
        {
            bypassCSP : true,
        }
    );

    const timeout = timeoutOption || DEFAULT_TIMEOUT;

    page.setDefaultTimeout( timeout );
}

function parseArgs() {
    return yargs( hideBin( process.argv ) )
        .usage( `Usage: $0 [-b|bobcat-redirects-endpoint <Bobcat Redirects endpoint>] [-x|--exclude <service name> [--headed] [-l|--limit <number>] [-r|--replace] <TEST_CASE_GROUP: ${TEST_CASE_GROUPS.join( '|' )}>` )
        .option( 'bobcat-redirects-endpoint', {
            alias       : 'b',
            description : 'Override Bobcat Redirects endpoint',
            type        : 'string',
        } )
        .option( 'headed', {
            type        : 'boolean',
            description : 'Run playwright in "headed" mode',
        } )
        .option( 'limit', {
            type        : 'number',
            description : 'Set the number of samples to fetch',
        } )
        .option( 'replace', {
            alias       : 'r',
            type        : 'boolean',
            description : 'Replace existing sample files',
        } )
        .option( 'timeout', {
            alias       : 't',
            description : 'Set Playwright timeout',
            type        : 'number',
        } )
        .check( ( argv, options ) => {
            if ( argv._.length === 1 ) {
                const testCaseGroup = argv._[ 0 ];
                if ( TEST_CASE_GROUPS.includes( testCaseGroup ) ) {
                    return true;
                } else {
                    return `"${testCaseGroup}" is not a recognized` +
                           ` test group. Please select from one of the following: ` +
                           TEST_CASE_GROUPS.join( ', ' );
                }
            } else {
                return `You must specify exactly one test case group.` +
                       ` Please select from one of the following: ` +
                       TEST_CASE_GROUPS.join( ', ' );
            }
        } )
        .parse();
}

// Based on "Alternative" in https://www.npmjs.com/package/sleep for Node 9.3 and higher
function sleepSeconds( seconds ) {
    Atomics.wait( new Int32Array( new SharedArrayBuffer( 4 ) ), 0, 0, seconds * 1000 );
}

function writeIndex() {
    fs.writeFileSync( indexFile, JSON.stringify( index, null, '    ' ), { encoding : 'utf8' } );
}

async function main() {
    const argv = parseArgs();

    let bobcatRedirectsEndpointOverride;
    if ( argv.bobcatRedirectsEndpoint ) {
        bobcatRedirectsEndpointOverride = argv.bobcatRedirectsEndpoint;
    }

    if ( argv.headed ) {
        headed = true;
    }

    testCaseGroup = argv._[ 0 ];

    indexFile = path.join( RESPONSE_SAMPLES_DIR, testCaseGroup, INDEX_FILE_NAME );

    index = getIndex();

    testCasePaths = getTestCasePaths();

    // Replace existing sample files and index entries?
    if ( !argv.replace ) {
        const indexUrls = Object.keys( index );
        testCasePaths = testCasePaths.filter( testCaseUrl => !indexUrls.includes( testCaseUrl ) );
    }

    if ( argv.limit ) {
        testCasePaths = testCasePaths.slice( 0, argv.limit );
    }

    await initializePlaywright( argv.timeout );

    let serviceSamplers = [
        new BobcatRedirectsServiceSampler(
            testCaseGroup,
            page,
            bobcatRedirectsEndpointOverride,
        ),
        new BobcatPrimoClassicServiceSampler(
            testCaseGroup,
            page,
            bobcatRedirectsEndpointOverride,
        ),
    ];

    if ( argv.exclude ) {
        const exclude = (
            Array.isArray( argv.exclude ) ? argv.exclude.slice() : [ argv.exclude ]
        )
            .map( element => element.toLowerCase() );
        serviceSamplers = serviceSamplers.filter( serviceSampler => {
            return !exclude.includes( serviceSampler.serviceName );
        } );
    }

    // Note that the order of the samplers in the array arg is the same order in
    // which Playwright will serially run them to get their respective sample responses.
    await fetchResponseSamples( serviceSamplers );

    browser.close();
}

main();
