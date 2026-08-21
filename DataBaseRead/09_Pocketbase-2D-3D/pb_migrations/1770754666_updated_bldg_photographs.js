/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // add field
  collection.fields.addAt(18, new Field({
    "hidden": false,
    "id": "select1570776151",
    "maxSelect": 1,
    "name": "camera_bldg_orientation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "front",
      "rear",
      "side",
      "roof",
      "interior"
    ]
  }))

  // add field
  collection.fields.addAt(19, new Field({
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

  // add field
  collection.fields.addAt(20, new Field({
    "hidden": false,
    "id": "select3644461697",
    "maxSelect": 1,
    "name": "spatial_scope",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "overall",
      "near_overall",
      "partial",
      "detail",
      "fragments"
    ]
  }))

  // add field
  collection.fields.addAt(26, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text377626378",
    "max": 0,
    "min": 0,
    "name": "LINK_ARCHITECTURAL_ELEMENT",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(17, new Field({
    "hidden": false,
    "id": "bool2789707706",
    "name": "verticals_corrected",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1645766414")

  // remove field
  collection.fields.removeById("select1570776151")

  // remove field
  collection.fields.removeById("select2137105358")

  // remove field
  collection.fields.removeById("select3644461697")

  // remove field
  collection.fields.removeById("text377626378")

  // update field
  collection.fields.addAt(20, new Field({
    "hidden": false,
    "id": "bool2789707706",
    "name": "orthophoto",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
})
