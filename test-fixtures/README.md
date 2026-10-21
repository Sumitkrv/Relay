# Relay Test Fixtures Directory

Place the provided QA demo bundle files here:

1. `Relay_Demo_QA_Bundle.zip` (OR unzipped contents)
2. `Relay_Demo_Contacts_60.csv` (or `Relay_Real_Estate_Demo_60.csv`)
3. `Relay_Import_Edge_Cases_12.csv`
4. `Relay_Demo_Test_Pack.xlsx`

Once placed here, the demo seeding commands and integration test suite (`npm run seed:demo`, `npm run demo:reset`) will automatically read and validate these files against the application's domain models and import pipeline.
