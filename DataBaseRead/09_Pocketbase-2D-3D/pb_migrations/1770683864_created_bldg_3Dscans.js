/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file2359244304",
        "maxSelect": 1,
        "maxSize": 0,
        "mimeTypes": [],
        "name": "file",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1843675174",
        "max": 0,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number797183770",
        "max": null,
        "min": null,
        "name": "depicts_osm_id",
        "onlyInt": true,
        "presentable": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "select3307309425",
        "maxSelect": 1,
        "name": "depicts_osm_type",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "way",
          "relation",
          "node"
        ]
      },
      {
        "hidden": false,
        "id": "select2361137806",
        "maxSelect": 1,
        "name": "capture_extent",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "full",
          "full exterior",
          "full interior",
          "exterior detail",
          "interior detail"
        ]
      },
      {
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
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2004652854",
        "max": 0,
        "min": 0,
        "name": "point_density",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select2189298940",
        "maxSelect": 2,
        "name": "data_modifications",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "raw",
          "cleaned",
          "combined",
          "segmented"
        ]
      },
      {
        "hidden": false,
        "id": "select4109072806",
        "maxSelect": 1,
        "name": "capture_method",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "terrestrial",
          "aerial"
        ]
      },
      {
        "hidden": false,
        "id": "select2278256268",
        "maxSelect": 1,
        "name": "capture_principle",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "photogrammetry",
          "laserscanning",
          "combination",
          "other"
        ]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text94741151",
        "max": 0,
        "min": 0,
        "name": "capture_software",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2364285872",
        "max": 0,
        "min": 0,
        "name": "capture_hardware",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1251797379",
        "max": 0,
        "min": 0,
        "name": "modification_software",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool1618295025",
        "name": "scale_accurate",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text401070258",
        "max": 0,
        "min": 0,
        "name": "LINK_AFFILIATION_AUTHOR_ATTRIBUTES",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3780548041",
        "max": 0,
        "min": 0,
        "name": "LINK_PROJECT_ATTRIBUTES",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text969057488",
        "max": 0,
        "min": 0,
        "name": "LINK_POINTCLOUD_SPECIFIC_ATTRIBUTES",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1697932570",
        "max": 0,
        "min": 0,
        "name": "LINK_MODIFICATION_STEP_ATTRIBUTES",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_1059467251",
    "indexes": [],
    "listRule": null,
    "name": "bldg_3Dscans",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1059467251");

  return app.delete(collection);
})
