/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  if ($os.getenv("DEMO_UPLOAD_PROVISION") !== "1") return
  const email = $os.getenv("POCKETBASE_SUPERUSER_EMAIL")
  const password = $os.getenv("POCKETBASE_SUPERUSER_PASSWORD")
  if (!email || !password) return

  const collection = app.findCollectionByNameOrId("_superusers")
  let record
  try {
    record = app.findAuthRecordByEmail("_superusers", email)
  } catch {
    record = new Record(collection)
    record.set("email", email)
  }
  record.set("password", password)
  return app.save(record)
}, (app) => {
  if ($os.getenv("DEMO_UPLOAD_PROVISION") !== "1") return
  try {
    const record = app.findAuthRecordByEmail("_superusers", $os.getenv("POCKETBASE_SUPERUSER_EMAIL"))
    return app.delete(record)
  } catch {
    // The generated demo account does not exist.
  }
})
