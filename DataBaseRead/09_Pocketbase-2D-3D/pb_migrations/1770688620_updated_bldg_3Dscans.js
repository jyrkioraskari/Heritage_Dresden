/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select3736761055",
    "maxSelect": 1,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "e57",
      "glb",
      "obj",
      "other"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select3736761055",
    "maxSelect": 1,
    "name": "format",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "e57",
      "glb",
      "other"
    ]
  }))

  return app.save(collection)
})
