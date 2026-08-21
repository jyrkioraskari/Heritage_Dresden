/// <reference path="../pb_data/types.d.ts" />

const archiveCollections = [
  "bldg_photographs",
  "bldg_plans",
  "bldg_3D",
  "bldg_texts",
  "maps",
]

migrate((app) => {
  for (const name of archiveCollections) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.add(new Field({
      "hidden": false,
      "id": "placementScope",
      "maxSelect": 1,
      "name": "placement_scope",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "select",
      "values": ["building", "level", "point", "area"],
    }))
    collection.fields.add(new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "buildingLevel",
      "max": 32,
      "min": 0,
      "name": "building_level",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text",
    }))
    collection.fields.add(new Field({
      "hidden": false,
      "id": "floorplanPointX",
      "max": 1,
      "min": 0,
      "name": "floorplan_x",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number",
    }))
    collection.fields.add(new Field({
      "hidden": false,
      "id": "floorplanPointY",
      "max": 1,
      "min": 0,
      "name": "floorplan_y",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number",
    }))
    app.save(collection)
  }
}, (app) => {
  for (const name of archiveCollections) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.removeById("placementScope")
    collection.fields.removeById("buildingLevel")
    collection.fields.removeById("floorplanPointX")
    collection.fields.removeById("floorplanPointY")
    app.save(collection)
  }
})
