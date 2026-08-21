/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(22, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text850083899",
    "max": 0,
    "min": 0,
    "name": "LINK_AFFILIATION_ATTRIBUTES",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "select1488331270",
    "maxSelect": 1,
    "name": "depicts_bldg_part",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "facade",
      "roof",
      "interior",
      "facade detail",
      "interior detail"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("text850083899")

  // update field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "select1488331270",
    "maxSelect": 1,
    "name": "depicts_bldg_part",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "facade",
      "roof",
      "interior"
    ]
  }))

  return app.save(collection)
})
