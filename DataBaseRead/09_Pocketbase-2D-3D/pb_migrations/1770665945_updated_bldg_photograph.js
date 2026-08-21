/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("text4142125153")

  // add field
  collection.fields.addAt(18, new Field({
    "hidden": false,
    "id": "number4142125153",
    "max": null,
    "min": null,
    "name": "lon",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(18, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text4142125153",
    "max": 0,
    "min": 0,
    "name": "lon",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("number4142125153")

  return app.save(collection)
})
