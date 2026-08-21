/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // add field
  collection.fields.addAt(21, new Field({
    "hidden": false,
    "id": "select1466496025",
    "maxSelect": 1,
    "name": "license",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "CC 0",
      "CC BY",
      "CC BY-SA",
      "CC BY-NC",
      "CC BY-NC-SA"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251")

  // remove field
  collection.fields.removeById("select1466496025")

  return app.save(collection)
})
