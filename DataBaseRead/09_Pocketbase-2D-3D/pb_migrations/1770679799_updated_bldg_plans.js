/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3401884124",
    "max": 0,
    "min": 0,
    "name": "LINK_SOURCE_ATTRIBUTES_source_label",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // remove field
  collection.fields.removeById("text3401884124")

  return app.save(collection)
})
