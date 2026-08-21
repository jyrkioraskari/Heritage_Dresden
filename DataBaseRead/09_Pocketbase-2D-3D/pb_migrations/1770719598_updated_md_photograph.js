/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2961477348")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "bool685547339",
    "name": "mandatory",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2961477348")

  // remove field
  collection.fields.removeById("bool685547339")

  return app.save(collection)
})
