import { AbstractServiceSampler } from './AbstractServiceSampler.js';

export class BobcatRedirectsServiceSampler extends AbstractServiceSampler {
    static #defaultEndpoint = 'http://localhost:3000/';

    constructor( testCaseGroup, page, endpointOverride ) {
        super(
            'BobcatRedirects',
            'bobcat-redirects',
            testCaseGroup,
            page,
            endpointOverride || BobcatRedirectsServiceSampler.#defaultEndpoint
        );
    }

    getWaitForPromise() {
        return this.page.locator( 'h4:has-text( "Send to" )' ).waitFor();
    }
}
