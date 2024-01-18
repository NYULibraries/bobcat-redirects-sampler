import * as fs from 'node:fs';
import * as path from 'node:path';

// https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
// See "Option 2: Leverage the CommonJS require function to load JSON files"
import { createRequire } from 'node:module';

const require = createRequire( import.meta.url );

import { fileURLToPath } from 'url';
// https://stackoverflow.com/questions/64383909/dirname-is-not-defined-in-node-14-version
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

import Papa from 'papaparse';

const ROOT_DIR = path.join( __dirname, '..' );
const TMP_DIR = path.join( ROOT_DIR, 'tmp' );

const ASSETS_FILE_ORIGINAL = path.join(
    ROOT_DIR,
    'test-case-files',
    'libguides',
    'libguides-links.csv',
);

const ASSETS_FILE_NEW = path.join(
    TMP_DIR,
    'libguides-assets.csv',
);

const permalinksToRedirectTargetUrlsMap = require( path.join(
    TMP_DIR,
    'permalinks-to-redirect-target-urls-map.json',
) );

function main() {
    const configParse = {
        delimiter              : ',',	// auto-detect
        newline                : '',	// auto-detect
        quoteChar              : '"',
        escapeChar             : '"',
        header                 : true,
        transformHeader        : undefined,
        dynamicTyping          : false,
        preview                : 0,
        encoding               : '',
        worker                 : false,
        comments               : false,
        step                   : undefined,
        complete               : undefined,
        error                  : undefined,
        download               : false,
        downloadRequestHeaders : undefined,
        downloadRequestBody    : undefined,
        skipEmptyLines         : false,
        chunk                  : undefined,
        chunkSize              : undefined,
        fastMode               : undefined,
        beforeFirstChunk       : undefined,
        withCredentials        : undefined,
        transform              : undefined,
        delimitersToGuess      : [ ',', '\t', '|', ';', Papa.RECORD_SEP, Papa.UNIT_SEP ],
        skipFirstNLines        : 0.
    };

    const originalCsv = fs.readFileSync( ASSETS_FILE_ORIGINAL, { encoding : 'utf8' } );
    const papaData = Papa.parse( originalCsv, configParse );
    const newRedirectTargetUrlFieldName =
        'Redirect Target URL (2024-01-18: version 94588b47a688447b1e2e44589312c6169f1a0bdd)';
    papaData.data.forEach( row => {
        row[ newRedirectTargetUrlFieldName ] =
            permalinksToRedirectTargetUrlsMap[ row.URL ]?.redirectTargetUrl;
    } );
    papaData.meta.fields.push( newRedirectTargetUrlFieldName );

    const configUnparse = {
        quotes         : false,
        quoteChar      : '"',
        escapeChar     : '"',
        delimiter      : ",",
        header         : true,
        newline        : "\n",
        skipEmptyLines : false,
        columns        : null,
    }

    const newCsv = Papa.unparse( papaData, configUnparse );

    fs.writeFileSync( ASSETS_FILE_NEW, newCsv, { encoding : 'utf8' } );
}

main();
