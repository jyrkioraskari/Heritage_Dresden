/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "select3736761055",
    "maxSelect": 1,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "dwg/dxf",
      "pdf",
      "jpg"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // remove field
  collection.fields.removeById("select3736761055")

  return app.save(collection)
})
