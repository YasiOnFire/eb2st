# EndomondoBackup2SportsTracker Converter/Importer  (eb2st)

Convert endomondo backup data and import to your SportsTracker account.

---
Since sports-tracker does not have an official API and importing endomondo data directly form your endo backup is painful (you need to convert tcx files to gpx, then import max. 10 files at one, and manually assign workout type, and manually upload photos) this app will load all your workouts data, convert selected workouts, and automagicaly import and assign propper workout types to sports-tracker (also it will upload your photos to your workouts).

---

![gif](https://user-images.githubusercontent.com/3300701/111077400-e8578780-84f0-11eb-81d0-806f508e209a.gif)

# Usage
1. [Download](https://github.com/YasiOnFire/eb2st/releases/download/0.0.2/eb2st-0.0.2-setup.exe) and install or [start](https://github.com/YasiOnFire/eb2st/releases/download/0.0.2/EndomondoBackup2SportsTracker-win32-x64.zip) (portable version) the app
2. Select your endomondo backup directory
3. Select workouts you whant to import
4. Converting and importing your workouts may thake a few minutes. (380 workouts with photos took about 8 minutes for me).

# Development

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

## Note

* No credentials are stored. They are used to log in to your sports-tracker account to perform the import
* Some of the converted workouts just do not work in sports-tacker (it's a small percentage thought)
* You can build executables for other OS'es (or just run form the source)
