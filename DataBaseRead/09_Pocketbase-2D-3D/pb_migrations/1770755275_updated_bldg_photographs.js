/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(18, new Field({
    "hidden": false,
    "id": "bool27897077062",
    "name": "orthophoto",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(30, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1751314692",
    "max": 0,
    "min": 0,
    "name": "DEPICTS_EVENT_ID",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "date2011722078",
    "max": "",
    "min": "",
    "name": "creation_date_original",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("bool27897077062")

  // remove field
  collection.fields.removeById("text1751314692")

  // update field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "date2011722078",
    "max": "",
    "min": "",
    "name": "creation_date",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
})
