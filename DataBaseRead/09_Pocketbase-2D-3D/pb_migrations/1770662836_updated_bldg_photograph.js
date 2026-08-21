/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "number797183770",
    "max": null,
    "min": null,
    "name": "depicts_osm_id",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "select3307309425",
    "maxSelect": 1,
    "name": "depicts_osm_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "way",
      "node",
      "relation"
    ]
  }))

  // add field
  collection.fields.addAt(13, new Field({
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
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("number797183770")

  // remove field
  collection.fields.removeById("select3307309425")

  // remove field
  collection.fields.removeById("select1488331270")

  return app.save(collection)
})
