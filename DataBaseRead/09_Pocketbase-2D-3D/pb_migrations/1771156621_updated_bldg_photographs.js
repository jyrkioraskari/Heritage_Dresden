/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "select2137105358",
    "maxSelect": 1,
    "name": "camera_angle",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "frontal",
      "oblique",
      "top-down",
      "bottom-up"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "select2137105358",
    "maxSelect": 1,
    "name": "camera_angle",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "frontal",
      "oblique",
      "top-down"
    ]
  }))

  return app.save(collection)
})
