/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // update collection data
  unmarshal({
    "name": "bldg_3D"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // update collection data
  unmarshal({
    "name": "bldg_3Dscans"
  }, collection)

  return app.save(collection)
})
