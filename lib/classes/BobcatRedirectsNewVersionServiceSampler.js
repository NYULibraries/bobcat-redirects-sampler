import { AbstractServiceSampler } from './AbstractServiceSampler.js';

export class BobcatRedirectsNewVersionServiceSampler extends AbstractServiceSampler {
    static #defaultEndpoint = 'http://localhost:3001/';

    constructor( testCaseGroup, page, endpointOverride ) {
        super(
            'BobcatRedirectsNewVersion',
            'bobcat-redirects-new-version',
            testCaseGroup,
            page,
            endpointOverride || BobcatRedirectsNewVersionServiceSampler.#defaultEndpoint
        );
    }

    getWaitForPromise() {
        return this.page.locator( 'h4:has-text( "Send to" )' ).waitFor();
    }
}
