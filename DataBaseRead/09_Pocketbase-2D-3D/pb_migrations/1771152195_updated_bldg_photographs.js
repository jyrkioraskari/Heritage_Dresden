/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("select1488331270")

  // add field
  collection.fields.addAt(18, new Field({
    "hidden": false,
    "id": "bool2763347720",
    "name": "black_and_white",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // update field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 1,
    "name": "type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "photograph",
      "painting/engraving",
      "postcard",
      "photogrammetry_row"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

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
      "interior",
      "facade detail",
      "interior detail"
    ]
  }))

  // remove field
  collection.fields.removeById("bool2763347720")

  // update field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 1,
    "name": "type",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "photograph",
      "painting/engraving",
      "postcard"
    ]
  }))

  return app.save(collection)
})
