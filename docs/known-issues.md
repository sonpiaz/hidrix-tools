# Known Issues

Tracked limitations and quirks. Updated as issues are discovered.

## Active

### facebook_scraper — group mode returns 0 posts (Apify free tier)

- **Status**: 🟠 Open
- **Since**: 2026-04-03
- **Actor**: `crowdpull/facebook-group-posts-scraper`
- **Symptom**: Run succeeds but dataset is empty for known public groups
- **Cause**: Likely free tier limitation on Apify — actor needs residential proxy credits
- **Workaround**: Use `page` mode instead (works), or upgrade Apify plan
- **Fix plan**: Add fallback actor or switch default group actor

### facebook_scraper — ads mode untested

- **Status**: 🟡 Open
- **Since**: 2026-04-03
- **Symptom**: `META_ADS_ACCESS_TOKEN` not yet configured for testing
- **Cause**: Requires FB Developer account setup
- **Workaround**: Use page/search modes until token is obtained

## Resolved

_None yet._
