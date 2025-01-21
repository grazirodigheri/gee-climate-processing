/**
* @description
*    Retrieve climate data from CHIRPS
* 
* @author 
*    Grazieli Rodigheri - 2025/1
*/ 

// ====================================================================================
// Define the Regioin Of Interest (ROI)
var roi = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/REGIOES/VETOR/PAMPA_regioes_col05')

// Define climate collection
var climateColl = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')

// Define the scale of the collection
var collScale = 5566
 
// Define the start and end of period
var startDate = '1999-01-01';
var endDate = '2000-12-31';

// =========================================================
// ====== Function to compute monthly precipitation  =======
// =========================================================

/**
* Calculate monthly precipitation for the ROI
* @param coll (ImageCollection): Input Image Collection
* @param ROI (FeatureCollection): Bounds
* @param startDate (Date): Start date of the period (format: "AAAA-MM-DD")
* @param endDate (Date): End date of the period  (format: "AAAA-MM-DD")
*/

// Select and filter the collection
var computeSumMonthly = function(coll, ROI, startDate, endDate) {
  var collection = coll
    .filterBounds(ROI)
    .filterDate(startDate, endDate)
    .select('precipitation');

  print("Collection", collection.limit(100));
  Map.addLayer(collection.first().clip(ROI), 
    {min: 1, max: 17, palette: ['001137', '0aab1e', 'e7eb05', 'ff4a2d', 'e90000']}, 
    'Precipitation');
  
  // Add 'month' property for each image
  var collectionWithMonth = collection.map(function(image) {
    var date = ee.Date(image.get('system:time_start'));
    var month = date.get('month'); // Get the month
    return image.set('month', month);
  });

  // Calculate mean monthly precipitacion 
  var monthlySum = ee.FeatureCollection(ee.List.sequence(1, 12).map(function(month) {
    var monthCollection = collectionWithMonth.filter(ee.Filter.eq('month', month));
    var data = monthCollection.sum()
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: ROI,
        scale: collScale,
        maxPixels: 1e13
      })
      .set('month', month);

    return ee.Feature(null, data);
  }));

  return monthlySum;
}

// ====================================================================================
// Pre-process the ROI
var geomRoi = roi.geometry()
var line_geom = ee.Image().paint(roi,'vazio', 1).eq(0)
var visPar = {'palette':'000000','opacity': 1};
Map.addLayer(line_geom, visPar, 'Region Shape')

print("==============================\nRESULTS")
// Compute the monthly precipitation
var monthlySumPrecipitacion = computeSumMonthly(climateColl, geomRoi, startDate, endDate);
print("Monthly Precipitacion", monthlySumPrecipitacion)

// Exporta o resultado para um CSV
Export.table.toDrive({
  collection: monthlySumPrecipitacion,
  description: 'monthly_precipitacion_30Years_CHIRPS',
  folder: "GEE_tables",
  fileNamePrefix: 'monthly_precipitacion_30Years_CHIRPS',
  fileFormat: 'CSV'
});