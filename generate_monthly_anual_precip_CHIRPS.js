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
 
// Define the start and end of the period
var startYear = '1991';
var endYear = '2020';

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

// Function to calculate monthly averages by year and consolidate into a single collection
var computeSumMonthly = function(coll, ROI, startDate, endDate) {
  // Filter collection
  var collection = coll
    .filterBounds(ROI)
    .filterDate(startDate, endDate)
    .select('precipitation');

  // List of unique years and months based on `system:time_start`
  var years = collection.aggregate_array('system:time_start')
    .map(function(ts) {
      return ee.Date(ts).get('year');
    }).distinct();
  var months = ee.List.sequence(1, 12); // Months from 1 to 12

  // Generate monthly averages by year
  var monthlySumByYear = years.map(function(year) {
    return months.map(function(month) {
      var filtered = collection
        .filter(ee.Filter.calendarRange(year, year, 'year'))
        .filter(ee.Filter.calendarRange(month, month, 'month'));

      // Calculate the sum for the specific month and year
      var meanImage = filtered.sum().set({'year': year, 'month': month});
      return meanImage;
    });
  }).flatten();
  // Transform into an ImageCollection
  var monthlyCollection = ee.ImageCollection(monthlySumByYear);

  // Calculate the annual monthly average (average for each month across all years)
  var monthlyAnnualMeans = months.map(function(month) {
    var filtered = monthlyCollection.filter(ee.Filter.eq('month', month));
    var meanImage = filtered.mean().rename("mean");
    var stdDevImage = filtered.reduce(ee.Reducer.stdDev()).rename("std");
    return meanImage.addBands(stdDevImage).set({'month': month});
  });
  // Transform into an ImageCollection
  var monthlyAnnualCollection = ee.ImageCollection(monthlyAnnualMeans);

  // Calculate the mean and standard deviation for all 12 images
  var meanImage = monthlyAnnualCollection.select("mean").mean().clip(ROI);
  var stdDevImage = monthlyAnnualCollection.select("mean").reduce(ee.Reducer.stdDev()).clip(ROI);

  return {
    monthlyCollection: monthlyCollection,
    monthlyAnnualCollection: monthlyAnnualCollection,
    meanImage: meanImage,
    stdDevImage: stdDevImage
  };
};

// ====================================================================================
// Pre-process the ROI
var geomRoi = roi.geometry();
var line_geom = ee.Image().paint(roi,'vazio', 1).eq(0);
var visPar = {'palette':'000000','opacity': 1};

// Compute the monthly precipitation
var result = computeSumMonthly(climateColl, geomRoi, startYear+'-01-01', endYear+'-12-31');

// Visualize the collections
Map.addLayer(result.stdDevImage, 
  {min: 10, max: 45, palette: ['#fcffa4', '#fca50a', '#dd513a', '#932667', '#420a68', '#000004']}, "StdDev");
Map.addLayer(result.meanImage, 
  {min: 50, max: 180, palette: ['#fde725', '#7ad151', '#22a884', '#2a788e', '#414487', '#440154']}, "Mean");
Map.addLayer(line_geom, visPar, 'Region Shape');

// Export the mean image of all months to Google Drive
var exportImg = function(img, name) {
  Export.image.toDrive({
  image: img, 
  description: name, 
  folder: 'GEE_exports', 
  fileNamePrefix: name, 
  region: geomRoi,  
  scale: collScale, 
  maxPixels: 1e8, 
  crs: 'EPSG:4326' 
});
}
exportImg(result.meanImage, 'mean_precipitation_all_months')
exportImg(result.stdDevImage, 'std_precipitation_all_months')

// ====================================================================================
// Export CSV

// Regional Reduction for Annual Monthly Averages
var monthlyStats = result.monthlyAnnualCollection.map(function(image) {
  var meanValue = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geomRoi,
    scale: collScale,
    maxPixels: 1e13
  }).get('mean');

  var stdValue = image.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geomRoi,
    scale: collScale,
    maxPixels: 1e13
  }).get('std');

  return ee.Feature(null, {
    'month': image.get('month'),
    'mean': meanValue,
    'std': stdValue
  });
});
// Transform into FeatureCollection
var monthlyFeatureCollection = ee.FeatureCollection(monthlyStats);

// Export the collections or processed data
Export.table.toDrive({
  collection: monthlyFeatureCollection,
  description: 'precip_CHIRPS_'+startYear+"_"+endYear,
  folder: "GEE_tables",
  fileNamePrefix: 'precip_CHIRPS_'+startYear+"_"+endYear,
  fileFormat: 'CSV'
});

// ====================================================================================
// Generate chart of the monthly data
print("----------------------------------------------------\nRESULTS");

// Define month names for display
var monthNames = [
  {v: 1, f: 'Jan'}, {v: 2, f: 'Feb'}, {v: 3, f: 'Mar'}, {v: 4, f: 'Apr'}, 
  {v: 5, f: 'May'}, {v: 6, f: 'Jun'}, {v: 7, f: 'Jul'}, {v: 8, f: 'Aug'}, 
  {v: 9, f: 'Sep'}, {v: 10, f: 'Oct'}, {v: 11, f: 'Nov'}, {v: 12, f: 'Dec'}
];

// Create the chart combining bars and line
var precipitationChart = ui.Chart.feature.byFeature({
  features: monthlyFeatureCollection,
  xProperty: 'month',
  yProperties: ['mean', 'std']
})
  .setChartType('ComboChart')  // Use ComboChart to combine bars and lines
  .setOptions({
    title: 'Monthly Precipitation',
    hAxis: {
      title: 'Month',
      format: '0',
      ticks: monthNames
    },
    vAxis: {
      title: 'Precipitation (mm)',
      gridlines: {count: 6},
      minorGridlines: {count: 1},
      viewWindow: {min: 0}
    },
    series: {
      0: {type: 'bars', color: '#09a0e6'}, // Mean as bars
      1: {type: 'line', color: '#1109e6', lineWidth: 2} // Standard deviation as a line
    },
    legend: {position: 'bottom'},
    bar: {groupWidth: "50%"}
  });

// Display the chart
print("Monthly Precipitation", precipitationChart);