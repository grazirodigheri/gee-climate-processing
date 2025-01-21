/**
* @description
*    Retrieve climate data from ERA5 - AGGREGATE DATA
* 
* @author 
*    Grazieli Rodigheri - 2024/12
*/ 

// ====================================================================================
// Define the Regioin Of Interest (ROI)
var roi = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/REGIOES/VETOR/PAMPA_regioes_col05')

// Define climate collection
var climateColl = ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR")

// Define the scale of the collection
var collScale = 11132
 
// Define the start and end of period
var startDate = '1991-01-01';
var endDate = '2020-12-31';

// =========================================================
// ====== Function to compute monthly precipitation  =======
// =========================================================

/**
* Pre-process temperature and precipitation bands
* @param img (Image): Input Image
*/

// Function to pre-process images
var preProcessImg = function(img) {
  // Converts temperature from Kelvin to Celsius
  var temperatureBands = img.select(['temperature_2m', 'temperature_2m_min', 'temperature_2m_max'])
    .subtract(273.15);
  
  // Converts precipitation from meters to millimeters
  var precipitationBands = img.select(['total_precipitation_sum', 'total_precipitation_min', 'total_precipitation_max'])
    .multiply(1000);
  
  // Adds processed bands to the original image
  return img.addBands(temperatureBands, null, true)
            .addBands(precipitationBands, null, true);
}

// ====================================================================================
/**
* Calculate monthly precipitation for the ROI
* @param coll (ImageCollection): Input Image Collection
* @param ROI (FeatureCollection): Bounds
* @param startDate (Date): Start date of the period (format: "AAAA-MM-DD")
* @param endDate (Date): End date of the period  (format: "AAAA-MM-DD")
*/

// Function to compute monthly averages over a 30-year period
var computeMeanMonthly = function(coll, ROI, startDate, endDate) {
  var collection = coll
    .filterBounds(ROI) // Filters by region of interest
    .filterDate(startDate, endDate) // Filters by the defined period
    .select([
      'total_precipitation_sum', 'total_precipitation_min', 'total_precipitation_max', 
      'temperature_2m', 'temperature_2m_min', 'temperature_2m_max'
    ])
    .map(preProcessImg); // Applies pre-processing
  print("Image Collection", collection);

  // Computes monthly averages
  var monthlyAverages = ee.FeatureCollection(ee.List.sequence(1, 12).map(function(month) {
    var monthlyCollection = collection.filter(ee.Filter.eq('month', month)); // Filters by month
    var data = monthlyCollection.mean() // Computes the monthly mean
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: ROI, // Defines the region of interest
        scale: collScale, 
        maxPixels: 1e13
      })
      .set('month', month); // Adds the month information

    return ee.Feature(null, data); // Creates a Feature for the month
  }));

  return monthlyAverages;
}

// ====================================================================================
// Pre-process the ROI
var geomRoi = roi.geometry()
var line_geom = ee.Image().paint(roi,'vazio', 1).eq(0)
var visPar = {'palette':'000000','opacity': 1};
Map.addLayer(line_geom, visPar, 'Region Shape')

print("==============================\nRESULTS");
// Defines the analysis period and computes monthly averages
var monthlyAverageCollection = computeMeanMonthly(climateColl, geomRoi, startDate, endDate);
print("Monthly Averages Collection", monthlyAverageCollection);

// ====================================================================================
// Exports the results to a CSV file on Google Drive
Export.table.toDrive({
  collection: monthlyAverageCollection,
  description: 'monthly_precip_temp_ERA5_30Years',
  fileFormat: 'CSV'
});
