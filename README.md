# EndomondoBackup2SportsTracker (eb2st)

Convert endomondo backup data and import to SportsTracker account.

---
Since sports-tracker does not have an official API and importing endomondo data directly form your endo backup is painful (you need to convert endo files, then import max 10 files at one, and manually assign workout type) this app will load all your workouts data, convert selected workouts, and automagicaly import and assign propper workout types to sports-tracker. And then will upload your photos to your workouts.

---

## Install the dependencies
```bash
yarn
```

### Start the app in development mode
```bash
npm run dev
```

### Build the app for production
```bash
npm run package
```

## IMPORTANT

* No credentials are stored. They are used to log in to your sports-tracker account to perform the import.
* Some of the converted workouts just do not work in sports-stacker (it's a small percentage)
* You can build executables for other OS'es. Or run form the source.
