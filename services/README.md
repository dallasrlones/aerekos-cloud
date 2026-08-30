# `services/`

This directory is reserved for optional shared code used only by aerekos-cloud.

**Database / ORM:** Use the published package **[aerekos-record](https://www.npmjs.com/package/aerekos-record)**. Add it to each app’s `package.json` (`conductor`, `worker/key_manager`, `worker/storage_manager`, `worker/db_manager`, etc.) and `require('aerekos-record')` — do not vendor a copy here.
