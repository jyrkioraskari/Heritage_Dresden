/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("text3736761055")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "number2719085998",
    "max": null,
    "min": null,
    "name": "resolution_p_width",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "select3736761055",
    "maxSelect": 1,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "jpg",
      "png",
      "tiff",
      "djvu",
      "other"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3736761055",
    "max": 0,
    "min": 0,
    "name": "format",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("number2719085998")

  // remove field
  collection.fields.removeById("select3736761055")

  return app.save(collection)
})
