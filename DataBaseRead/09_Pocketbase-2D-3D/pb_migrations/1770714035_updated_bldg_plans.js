/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // add field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "number1736004735",
    "max": null,
    "min": null,
    "name": "floor_plan_floor_number",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1716713439")

  // remove field
  collection.fields.removeById("number1736004735")

  return app.save(collection)
})
