/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // update field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "number2791224783",
    "max": null,
    "min": null,
    "name": "depicts_osm_id",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "select316304227",
    "maxSelect": 1,
    "name": "depicts_osm_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "way",
      "relation",
      "node"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // update field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "number2791224783",
    "max": null,
    "min": null,
    "name": "osm_id",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "select316304227",
    "maxSelect": 1,
    "name": "osm_type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "way",
      "relation",
      "node"
    ]
  }))

  return app.save(collection)
})
