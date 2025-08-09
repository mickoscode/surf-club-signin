# surf-club-signin
Simple wbesite to enable paperless signin for surf club activities

The intended use of this site is for very low volume (20 - 200 sign in/out events per day, for a specific club/group/activity).
Initially, there will only be 1 club/group/activity (sorrento/youth/sunday)... but this format will support other groups & activities within Sorrento Surf Life Saving Club, and possibly beyond.

For privacy and ease of use, there is no authentication or restrictions against signing in/out.
Anyone can sign a single name in/out... 
The assumption is that there is little to be gained by "fraudulently" signing someone else in/out, or signing in when not actually present.

The digital sign in/out process is purely to help with head counting (safety) and reducing paper waste.
So hopefully this simple trust model can provide a useful service.

## Website Primary Functionality - User POV

Nippers/Youth need to sign in and out each Sunday morning. 
A parent may want to do this on their child's behalf (e.g. child has no phone).

Nippers/Youth should only sign 1 person in/out (i.e. themself).
A parent may have more than 1 child they need to sign in/out (not supported currently, see age manager/leader for multi-sign in/out)

Site should automatically display sign in / out form, based on the time, otherwise display "no activity found" / "sign in starts at hh:mm" / "sign out ended at hh:mm"

## Website Primary Functionality - Age Manager POV (aka Leader, Coach, etc)

Age Managers (leaders/coaches) should be able to quickly sign multiple names in/out.

## Website Primary Functionality - Admins

Admin need ability to:
- set checking schedule (days of week, sign in window, sign out window)
- create new club, group & activity
- import list of names
- add/remove names from list
- generate report
- view list of reports (like /club/group/activity/reports/yyyy-mm-dd.csv)
- view individual report - display list of names, sign in time, sign out time
- export report as csv

## Site layout

www.site.com/club/group/activity/
- logically separate by club, group & activity (e.g. sorrento/youth/sunday, sorrento/redcaps/sunday,  etc)
- display sign in form  (if current day matches config.days and current time between config.in-start and config.in-end)
- display sign out form (if current day matches config.days and current time between config.out-start and config.out-end)
`.config` (needs encryption?)
  - leader:    \<aus_mobile\>,  # authenication against one of these mobiles allows multi-sign in/out
  - admin:     \<aus_mobile\>,  # authenication against one of these mobiles allows name & report management
  - days:      \<day\>,         # list of days the activity runs (monday, tuesday, wednesday, etc.)
  - in-start:  hh:mm          # users can sign in between this start & end time 
  - in-end:    hh:mm          # users can sign in between this start & end time 
  - out-start: hh:mm          # users can sign out between this start & end time 
  - out-end:   hh:mm          # users can sign out between this start & end time 

**Form:**
- name  (any chars except newline, comma, auto-complete against dictionary only)
- sign_in/out (correct button displayed based on current time and )

www.site.com/club/group/activity/admin/
- authenticate against mobile number (send sms code)
- display options: view reports, import names, add name, remove name, add admin/leader, remove admin/leader
- /import/ - allow upload of list, or display error if activity already has a list of names
- /add/name|admin|leader    - form to add one name (any chars except newline, comma) - clean for code injection - prompt for confo
- /remove/name|admin/leader - form to add one name (any chars except newline, comma) - clean for code injection - prompt for confo
- /view/ - form to select yyyy/mm/dd and generate (if needed) or display report - display error if no data

www.site.com/club/group/activity/leader/
- authenticate against mobile number (send sms code)
- display easy scroll list of all names, with single tap to sign in / out (if within window) - submit button to write selections to file
- need to clean / verify data so that duplicates are not appended to in.log or out.log 

www.site.com/new/
- authenticate against mobile number (send sms code)
- display form to add new club/group/activity/admins/leaders
`.config` (needs encryption)
  - site-admin: \<aus_mobile\>,  # authentication against one of these mobiles allows creation of new club/group/activity

**Form:**
- club     (alpha-numeric + '-' only, no space, no special charaters, limit = 20chars)
- group    (alpha-numeric + '-' only, no space, no special charaters, limit = 20chars)
- activity (alpha-numeric + '-' only, no space, no special charaters, limit = 20chars)
- days     (check box for mon - sun)
- sign-in-start  (hh:mm)
- sign-in-end    (hh:mm)
- sign-out-start (hh:mm)
- sign-out-start (hh:mm)
- leaders  (0-9, space, comma only) - comma seperated list of aus mobiles (04+ only)
- admins   (0-9, space, comma only) - comma seperated list of aus mobiles (04+ only)
- submit_button

## S3 structure

/club/group/activity/

/club/group/activity/reports/
- yyyy-mm-dd.csv - \<name\>,\<in\>,\<out\>

/club/group/activity/yyyy/mm/dd/
- in.log - \<name\>,hh:mm
- out.log - \<name\>,hh:mm

## Advanced Features

Automatically generate reports - 1 or 2 per day, scan folders (matching current date) and generate report (if missing) for any/all folders with data, if 8+ hours since last update 

## Non-functional reuirements

Only site can write to public S3 buckets - read only for everyone else
