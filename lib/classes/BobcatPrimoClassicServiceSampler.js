// This sampler isn't running against a `bobcat-redirects` instance, it's sampling
// an actual Primo Classic instance.  We have need for a rush, probably one time
// only sampling of LibGuides permalink URLs for BobCat, and it's easy enough
// to use this sampler project for that purpose as `bobcat-redirects` takes
// users to Primo instances.

import { AbstractServiceSampler } from './AbstractServiceSampler.js';

export class BobcatPrimoClassicServiceSampler extends AbstractServiceSampler {
    static #defaultEndpoint = 'https://bobcatdev.library.nyu.edu';

    constructor( testCaseGroup, page, endpointOverride ) {
        super(
            'BobcatPrimoClassic',
            'bobcat-primo-classic',
            testCaseGroup,
            page,
            endpointOverride || BobcatPrimoClassicServiceSampler.#defaultEndpoint
        );
    }

    getWaitForPromise() {
        return this.page.locator( 'h4:has-text( "Links" )' ).waitFor();
    }
}
