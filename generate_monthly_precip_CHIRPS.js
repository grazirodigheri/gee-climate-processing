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
var startDate = '1991-01-01';
var endDate = '2020-12-31';

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
  
    // Add 'month' and 'year' properties to each image
  var collectionWithMonthYear = collection.map(function(image) {
    var date = ee.Date(image.get('system:time_start'));
    var month = date.get('month'); // Get the month
    var year = date.get('year');   // Get the year
    return image.set('month', month).set('year', year);
  });

  // Get the list of unique years in the collection
  var years = collectionWithMonthYear.aggregate_array('year').distinct();
  var nYears = years.size(); // Number of unique years

  // Calculate the accumulated precipitation for each month
  var monthlyAccumulatedPrecipitation = ee.FeatureCollection(ee.List.sequence(1, 12).map(function(month) {
    var monthCollection = collectionWithMonthYear.filter(ee.Filter.eq('month', month));

    // Sum precipitation for the month across all years
    var monthlySum = monthCollection.sum()
      .reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: ROI,
        scale: collScale,
        maxPixels: 1e13
      })
      .get('precipitation');

    // Divide the accumulated monthly precipitation by the number of years
    var monthlyMean = ee.Number(monthlySum).divide(nYears);

    return ee.Feature(null, {
      'month': month,
      'mean_precipitation': monthlyMean
    });
  }));

  return monthlyAccumulatedPrecipitation;
};

// ====================================================================================
// Pre-process the ROI
var geomRoi = roi.geometry()
var line_geom = ee.Image().paint(roi,'vazio', 1).eq(0)
var visPar = {'palette':'000000','opacity': 1};
Map.addLayer(line_geom, visPar, 'Region Shape')

// Compute the monthly precipitation
var monthlySumPrecipitacion = computeSumMonthly(climateColl, geomRoi, startDate, endDate);
print("Monthly Precipitacion", monthlySumPrecipitacion)

// Export the result
Export.table.toDrive({
  collection: monthlySumPrecipitacion,
  description: 'monthly_precipitacion_30Years_CHIRPS',
  folder: "GEE_tables",
  fileNamePrefix: 'monthly_precipitacion_30Years_CHIRPS',
  fileFormat: 'CSV'
});

// ====================================================================================
// Generate chart of the data
print("----------------------------------------------------\nRESULTS")

// Array with month names
var monthNames = [
  {v: 1, f: 'Jan'}, 
  {v: 2, f: 'Feb'}, 
  {v: 3, f: 'Mar'}, 
  {v: 4, f: 'Apr'}, 
  {v: 5, f: 'Mai'}, 
  {v: 6, f: 'Jun'}, 
  {v: 7, f: 'Jul'}, 
  {v: 8, f: 'Aug'}, 
  {v: 9, f: 'Sep'}, 
  {v: 10, f: 'Oct'}, 
  {v: 11, f: 'Nov'}, 
  {v: 12, f: 'Dec'}
];

// Precipitation chart
var precipitationChart = ui.Chart.feature.byFeature({
  features: monthlySumPrecipitacion, 
  xProperty: 'month',
  yProperties: ['mean_precipitation']
})
.setOptions({
  title: 'Monthly Precipitation',
  hAxis: {
    // title: 'Month',
    format: '0',
    ticks: monthNames,
    gridlines: {
      color: '#f5f5f5'
    },
    minorGridlines: {
      color: '#f5f5f5',
      count: 1
    }
  },
  vAxis: {
    title: 'Precipitation (mm)',
    gridlines: {
      color: '#f5f5f5',
    },
    minorGridlines: {
      color: '#f5f5f5',
      count: 2
    }
  },
  series: {
    0: {color: '#0875d4'}
  }
});

// Adicionar o gráfico ao console
print(precipitationChart);

