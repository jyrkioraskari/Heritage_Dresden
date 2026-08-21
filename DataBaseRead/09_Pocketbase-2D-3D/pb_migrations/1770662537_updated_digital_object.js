/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update collection data
  unmarshal({
    "name": "bldg_photograph"
  }, collection)

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text4134925083",
    "max": 0,
    "min": 0,
    "name": "author_id",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select1466496025",
    "maxSelect": 1,
    "name": "license",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "CC BY",
      "CC BY-SA",
      "CC BY-NC",
      "CC BY-NC-SA",
      "CC 0"
    ]
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url2776776943",
    "name": "source_url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "number1876712713",
    "max": null,
    "min": null,
    "name": "resolution_p_height",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // update collection data
  unmarshal({
    "name": "digital_object"
  }, collection)

  // remove field
  collection.fields.removeById("text4134925083")

  // remove field
  collection.fields.removeById("select1466496025")

  // remove field
  collection.fields.removeById("url2776776943")

  // remove field
  collection.fields.removeById("number1876712713")

  return app.save(collection)
})
