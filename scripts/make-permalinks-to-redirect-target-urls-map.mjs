import glob from 'glob';
import * as fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath } from 'url';

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

// https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
// See "Option 2: Leverage the CommonJS require function to load JSON files"
import { createRequire } from 'module';
import process from "process";

// https://stackoverflow.com/questions/64383909/dirname-is-not-defined-in-node-14-version
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

const require = createRequire( import.meta.url );

const ROOT_DIR = path.join( __dirname, '..' );
const TMP_DIR = path.join( ROOT_DIR, 'tmp' );

const MAP_FILE = path.join(
    TMP_DIR,
    'permalinks-to-redirect-target-urls-map.json'
);
const TEST_CASE_FILES_DIR = path.join( ROOT_DIR, 'test-case-files' );

const TEST_CASE_GROUPS = fs.readdirSync( TEST_CASE_FILES_DIR );

const BOBCAT_REDIRECTS_BASE_URL_DEFAULT = 'http://localhost:3000';
let bobcatRedirectsBaseUrl = BOBCAT_REDIRECTS_BASE_URL_DEFAULT;

let request;
let permalinksToRedirectTargetUrlsMap = {};

// https://stackoverflow.com/questions/71396956/how-to-get-response-headers-from-a-https-module-in-node-js
function getHeaders( url ) {
    return new Promise( ( resolve, reject ) => {
        let headers = {};

        const req = request( url, ( res ) => {
            let discardedBody = '';
            headers = res.headers;
            res.on( 'data', ( chunk ) => {
                discardedBody += chunk;
            } )
            res.on( 'end', () => {
                resolve( headers );
            } )
        } )

        req.on( 'error', ( error ) => {
            reject( error );
        } );

        req.end();
    } );
}

function getTestCasePaths( testCaseGroup ) {
    const testCaseUrls = [];
    const directory = path.join( TEST_CASE_FILES_DIR, testCaseGroup );
    const testCaseFiles = glob.sync( `${ directory }/**/*.txt` );

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

function parseArgs() {
    return yargs( hideBin( process.argv ) )
        .usage( `Usage: $0 [-b|bobcat-redirects-endpoint <Bobcat Redirects endpoint>] [-l|--limit <number>] <TEST_CASE_GROUP: ${ TEST_CASE_GROUPS.join( '|' ) }>` )
        .option( 'bobcat-redirects-endpoint', {
            alias       : 'b',
            description : 'Override Bobcat Redirects endpoint',
            type        : 'string',
        } )
        .option( 'limit', {
            alias       : 'l',
            description : 'Set the number of samples to fetch',
            type        : 'number',
        } )
        .check( ( argv, options ) => {
            if ( argv._.length === 1 ) {
                const testCaseGroup = argv._[ 0 ];
                if ( TEST_CASE_GROUPS.includes( testCaseGroup ) ) {
                    return true;
                } else {
                    return `"${ testCaseGroup }" is not a recognized` +
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

async function main() {
    const argv = parseArgs();

    if ( argv.bobcatRedirectsEndpoint ) {
        bobcatRedirectsBaseUrl = argv.bobcatRedirectsEndpoint;
    }

    const protocol = new URL( bobcatRedirectsBaseUrl ).protocol;
    if ( protocol === 'http:' ) {
        request = http.request;
    } else if ( protocol === 'https:' ) {
        request = https.request;
    } else {
        // Should never get here
    }

    const testCaseGroup = argv._[ 0 ];

    const testCaseUrls = [];
    const directory = path.join( TEST_CASE_FILES_DIR, testCaseGroup );
    const testCaseFiles = glob.sync( `${ directory }/**/*.txt` );
    testCaseFiles.forEach( testCaseFile => {
        const lines = fs.readFileSync( testCaseFile, 'utf-8' );
        lines.split( /\r?\n/ ).forEach( line => {
            testCaseUrls.push( line )
        } );
    } );
    testCaseUrls.sort();

    const limit = argv.limit ? argv.limit + 1 : testCaseUrls.length;
    for ( let i = 0; i < limit; i++ ) {
        const testCaseUrl = testCaseUrls[ i ];

        if ( !testCaseUrl ) {
            continue;
        }

        if ( !testCaseUrl.match( new RegExp( '^https?://bobcat.library.nyu.edu/permalink.*/' ) ) ) {
            permalinksToRedirectTargetUrlsMap[ testCaseUrl ] = '';

            continue;
        }

        const testCasePath = new URL( testCaseUrl ).pathname;
        await (
            async () => {
                const url = `${ bobcatRedirectsBaseUrl }${ testCasePath }`;
                try {
                    const headers = await getHeaders( url );
                    const redirectTargetUrl = headers.location;
                    permalinksToRedirectTargetUrlsMap[ testCaseUrl ] = {
                        bobcatRedirectsUrl : url,
                        redirectTargetUrl
                    };

                    // Also stream CSV, in case need to abort the run before the
                    // map is finished and can be marshaled to JSON and written
                    // to file.
                    console.log( `"${ testCaseUrl }","${ redirectTargetUrl }` );
                } catch ( e ) {
                    console.error( e );
                }

            }
        )();
    }

    fs.writeFileSync(
        MAP_FILE,
        JSON.stringify( permalinksToRedirectTargetUrlsMap, null, '    ' ),
        { encoding : 'utf8' },
    );
}

main();


