const MAPBOX_TOKEN = '<replace_me>'
const API_KEY = '<replace_me>'
const MAPBOX_BASEMAP = 'mapbox://styles/mapbox/dark-v10'

const anytimeUtils = {
  /**
   * the features come with 3 properties that can be used to make different types of calculations
   * occ: all occurrences from all people
   * occLocTgt: all local occurrences of the target demographic
   * occNonLocTgt: all nonlocal (50+ miles) occurrences of the target demographic
   */
  productCalculations: {
    // local + nonlocal of the target. with "all people" demographic, this should equal occ[hour]
    target_total: (hoursData, hour) => hoursData.occLocTgt[hour] + hoursData.occNonLocTgt[hour],
    // nonlocal target people (50+ miles)
    target_nonlocal: (hoursData, hour) => hoursData.occNonLocTgt[hour],
    // percentage of target vs total people
    target_penetration: (hoursData, hour) => {
      const numerator = hoursData.occLocTgt[hour] + hoursData.occNonLocTgt[hour]
      const denominator = hoursData.occ[hour]
      // use Math.min(someVal, 100) to cap at 100, fixing off-by-1 errors in loc + nonLoc !== occ
      return Math.min(numerator / denominator * 100, 100) || 0 // utilize (NaN || 0) === 0
    },
    // percentage of nonlocal target vs total people
    target_nonlocal_penetration: (hoursData, hour) => (hoursData.occNonLocTgt[hour] / hoursData.occ[hour] * 100) || 0
  },
  // these are the available (or at least some of) the available demographics to select from
  // they will be used to populate a select dropdown to redraw anytime population accordingly
  demographicOptions: [
    { value: 'age_00plus', text: 'All Persons', calculation: 'target_total' },
    { value: 'age_00plus_nonlocal', text: 'Non-Local Visitors', calculation: 'target_nonlocal' },
    { value: 'age_00plus_nonlocal_penetration', text: 'Non-Local Visitors Percent', calculation: 'target_nonlocal_penetration' },
    { value: 'hhi_200plus', text: 'Households, Household Income $200,000+', calculation: 'target_total' },
    { value: 'hhi_200plus_penetration', text: 'Households, Household Income $200,000+ Percent', calculation: 'target_penetration' },
    { value: 'pz_seg06', text: "Winner's Circle", calculation: 'target_total' },
    { value: 'pz_seg06_penetration', text: "Winner's Circle Percent", calculation: 'target_penetration' },
    { value: 'pz_seg31', text: 'Connected Bohemians', calculation: 'target_total' },
    { value: 'pz_seg31_penetration', text: 'Connected Bohemians Percent', calculation: 'target_penetration' },
    { value: '06022', text: 'Organizations (types) contributed money to past 12 mo Political', calculation: 'target_total' },
    { value: '06022_penetration', text: 'Organizations (types) contributed money to past 12 mo Political Percent', calculation: 'target_penetration' },
    { value: '13004', text: 'No. of times used quick service restaurant past 30 days 10 times or more', calculation: 'target_total' },
    { value: '13004_penetration', text: 'No. of times used quick service restaurant past 30 days 10 times or more Percent', calculation: 'target_penetration' },
    { value: '15065', text: 'Events attended/places visited past 12 months Any theme park', calculation: 'target_total' },
    { value: '15065_penetration', text: 'Events attended/places visited past 12 months Any theme park Percent', calculation: 'target_penetration' },
    { value: '15081', text: 'Lifestyle characteristics Belong to health/fitness club or gym', calculation: 'target_total' },
    { value: '15081_penetration', text: 'Lifestyle characteristics Belong to health/fitness club or gym Percent', calculation: 'target_penetration' },
    { value: '16018', text: 'Internet sites visited/apps used past 30 days Spotify', calculation: 'target_total' },
    { value: '16018_penetration', text: 'Internet sites visited/apps used past 30 days Spotify Percent', calculation: 'target_penetration' },
    { value: '16049', text: 'Type of TV service household subscribes to No service', calculation: 'target_total' },
    { value: '16049_penetration', text: 'Type of TV service household subscribes to No service Percent', calculation: 'target_penetration' },
    { value: '16117', text: 'Wireless/cell phone carrier plan to switch next 12 months Yes', calculation: 'target_total' },
    { value: '16117_penetration', text: 'Wireless/cell phone carrier plan to switch next 12 months Yes Percent', calculation: 'target_penetration' },
    { value: '18010', text: 'Political party affiliation Democrat', calculation: 'target_total' },
    { value: '18010_penetration', text: 'Political party affiliation Democrat Percent', calculation: 'target_penetration' },
    { value: '18011', text: 'Political party affiliation Independent', calculation: 'target_total' },
    { value: '18011_penetration', text: 'Political party affiliation Independent Percent', calculation: 'target_penetration' },
    { value: '18015', text: 'Political party affiliation Republican', calculation: 'target_total' },
    { value: '18015_penetration', text: 'Political party affiliation Republican Percent', calculation: 'target_penetration' }
  ],
  // we will use these percentiles to determine the color scaling of anytime population
  // e.g the color for 0.5 is the 50th percentile or above, the color for .99 is in the 99th percentile or above (top 1%) of cells
  percentileSteps: [0, 0.5, 0.75, 0.9, 0.95, 0.99],
  // deck.gl uses [r, g, b, a] arrays for color
  scaleColors: [
    [218, 230, 213, 0],
    [64, 222, 168, 39.8],
    [39, 205, 148, 79.6],
    [39, 205, 148, 119.4],
    [37, 176, 128, 159.2],
    [246, 205, 83, 179.1]
  ],
  // get the value based on the calculation type and selected hour
  // data arrays come through with 25 values. hours 0-23 and 24 for daily average
  valueFunc (calculationType, hour, data) {
    // data can be passed as a full feature, or just it's properties
    // calculations are based on properties
    const calcData = data?.properties ? data.properties : data
    if (this.productCalculations[calculationType]) {
      return this.productCalculations[calculationType](calcData, hour)
    } else {
      return 0
    }
  },
  // util func to determine the calculation for the selected demographic
  getCalculation (demographic) {
    return this.demographicOptions.find(d => d.value == demographic)?.calculation || 'target_total'
  },
  /**
   * Turns values into the percentileSteps for color scaling of anytime population
   * there will be no duplicates as duplicate values will be increased by 0.01
   * @param {number[]} values sorted from smallest to largest
   * @returns number[] of values at each percentile step
   */
  valueToScale (values) {
    return this.percentileSteps.reduce((levels, step) => {
      levels.push(Math.max(
        values[Math.min(Math.ceil(values.length * step), values.length - 1)],
        (levels[levels.length - 1] || 0) + 0.01
      ))
      return levels
    }, [])
  },
  /**
   * h3 cells have different resolutions that change with zoom
   * this defines what zoom has what resolution
   * zooms higher than the maximum will have the maximum resolution
   * @param {number} zoom 
   * @returns number representing the resolution at the current zoom level for the h3 cells
   */
  getResolution (zoom) {
    const zoomResolutions = [
      { zoom: 0, resolution: 3 },
      { zoom: 1, resolution: 3 },
      { zoom: 2, resolution: 3 },
      { zoom: 3, resolution: 3 },
      { zoom: 4, resolution: 4 },
      { zoom: 5, resolution: 4 },
      { zoom: 6, resolution: 5 },
      { zoom: 7, resolution: 6 },
      { zoom: 8, resolution: 6 },
      { zoom: 9, resolution: 7 },
      { zoom: 10, resolution: 8 },
      { zoom: 11, resolution: 9 },
      { zoom: 12, resolution: 9 }
    ]
    const minZoom = zoomResolutions[0]?.zoom || 0
    const maxZoom = zoomResolutions[zoomResolutions.length - 1]?.zoom || 0
    const constrainedZoom = anytimeUtils.constrain(Math.floor(zoom), minZoom, maxZoom)
    const resolution = zoomResolutions.find(zr => zr.zoom === constrainedZoom)?.resolution || 3
    return resolution
  },
  /**
   * GET the config that will define the layers for anytime population
   * 
   * @returns an object containing a single entry representing the layer requested
   */
  loadAnytimeDemographicConfig (demographic, year, month, dayType) {
    // for sanity and readability, I've split this long url into parts
    const base = 'https://intermx-prod.apigee.net/v1/data/products/segments/anytime_population/v11/tiles'
    const datePart = `/year/${year}/month/${month}/day_type/${dayType}/day_part_system/hourly`
    const geographyPart = `/geography_system/h3/geography/global`
    const segmentPart = `/segment/${demographic}`
    const url = `${base}${datePart}${geographyPart}${segmentPart}/tilesets`
    return fetch(url, {
      headers: {
        'X-Intermx-API-Key': API_KEY
      }
    }).then((response) => {
      return Promise.resolve(response.json())
    })
  },
  constrain (desired, min, max) {
    return Math.min(max, Math.max(desired, min))
  }
}

const anytimePopulation = {
  map: null,
  demographic: 'age_00plus',
  demographicConfigs: {}, // cache the loaded configs so we don't have to load them multiple times
  periodMode: 'daily', // or hourly
  dayType: 'wk', // wk: full weeks, we: weekends, wd: weekdays
  year: '2022', // only available year currently
  month: '04', // only available month currently
  hour: 0, // 0-23 for hours of the day
  scalingHour: 24, // daily values are located in index 24
  mvtRepaint: 0, // change this value to force deck.gl to re-evaluate it's coloring function
  transformTimeout: null, // when we transform data loaded through deck.gl, repaint afterwards
  deck: null,
  cells: { }, // cache the features loaded through deck.gl to save time when repainting
  layers: { }, // keep track of the active layers to put into deck.gl

  getLayerID (dem = this.demographic, yr = this.year, mt = this.month) {
    return `anytime-pop-${dem}-${yr}-${mt}`
  },

  // demographic ids will have different calculations for the same demographic. when loading data from the server, we want to ask for the base demographic. calculations don't matter
  getDemographicBase (demographic = this.demographic) {
    return demographic.replace('_nonlocal', '').replace('_penetration', '')
  },

  // keep track of the layer configs with the information that causes the config to change
  getConfigID (demographic = this.demographic) {
    const baseName = this.getDemographicBase(demographic)
    return `${baseName}-${this.year}-${this.month}-${this.dayType}`
  },

  loadConfig (demographic = this.demographic) {
    const baseName = this.getDemographicBase(demographic)
    const configID = this.getConfigID(demographic)
    // cache the configs. if it exists in cache, return that instead
    if (this.demographicConfigs[configID]) {
      return Promise.resolve(this.demographicConfigs[configID])
    } else {
      // otherwise load it, and add it to the cache, then return it
      return anytimeUtils.loadAnytimeDemographicConfig(baseName, this.year, this.month, this.dayType).then(config => {
        this.demographicConfigs[configID] = config
        return Promise.resolve(config)
      })
    }
  },

  // the colors on the map are determined by RENDERED features.
  // this means that areas outside the map will not affect scale (making low population areas easier to see when zoomed in)
  getFeatures () {
    // simple but 100X slower way is to simply ask deck.gl for the rendered features
    // layerID = this.getLayerID()
    // layer = this.deck.layerManager.getLayers().find(l => l.id === layerID)
    // return layer.getRenderedFeatures()

    // more complex method caching cells and filtering down to rendered features using geometry
    const bounds = this.map.getBounds()
    const bbox = turf.bboxPolygon([bounds._sw.lng, bounds._sw.lat, bounds._ne.lng, bounds._ne.lat])
    const resolution = anytimeUtils.getResolution(this.map.getZoom())
    // use the cache of h3 cells to find features within the bounds of the map at the current resolution
    return Object.values(this.cells[this.demographic]?.[resolution] || {}).filter(feature => {
      const h3Cell = {
        type: 'Point',
        coordinates: h3.h3ToGeo(feature.h3).reverse()
      }
      return turf.booleanIntersects(h3Cell, bbox)
    })
  },

  // get all values of rendered features based on calculation type and selected hour (or daily)
  getValues () {
    const features = this.getFeatures()
    const allHours = Array(this.scalingHour + 1).fill(0).map((z, i) => i)
    const calculation = anytimeUtils.getCalculation(this.demographic)
    return features.reduce((valueList, feature) => {
      allHours.forEach(hour => {
        valueList.push(anytimeUtils.valueFunc(calculation, hour, feature))
      })
      return valueList
    }, []).sort((a, b) => parseFloat(a) - parseFloat(b))
  },

  repaint () {
    const valueLevels = anytimeUtils.valueToScale(this.getValues())
    const colorMap = {
      0: [0, 0, 0, 0],
      ...valueLevels.reduce((cMap, value, index) => {
        cMap[value] = anytimeUtils.scaleColors[index]
        return cMap
      }, {})
    }
    const colorValues = Object.keys(colorMap).map(k => Number(k)).sort((a, b) => b - a)
    const getFillColor = d => {
      const selectedHour = this.periodMode === 'daily' ? this.scalingHour : this.hour
      const value = anytimeUtils.valueFunc(anytimeUtils.getCalculation(this.demographic), selectedHour, d)
      const level = colorValues.find(v => value >= v) || 0
      return colorMap[level]
    }
    this.createMVTLayer(getFillColor)
    if (this.deck) {
      this.deck.setProps({ layers: Object.values(this.layers) })
      this.mvtRepaint = (this.mvtRepaint + 1) % 100
      this.deck.redraw(true)
    }
  },

  // data transform functions take string data and transform it to true arrays
  // this also caches the data into the cells attribute
  createDataTransform () {
    const transformationDemographic = this.demographic // copy this. as demographic changes we don't want to mess up the cache/transformation
    const hourCount = this.scalingHour + 1
    const fillerData = new Array(hourCount).fill(0) // default any bad data to an array of the correct size full of 0's
    return (data) => {
      const zoom = this.map.getZoom()
      const resolution = anytimeUtils.getResolution(zoom)
      const newData = data.map(d => {
        const newProperties = { }
        let propertyData = fillerData // default to the blank data
    
        // these feature.properties are json. parse them and validate them
        // they should all be length 25 (24 hours + daily)
        const parseProperties = ['occ', 'occLocTgt', 'occNonLocTgt']
        parseProperties.forEach(property => {
          // ensure these are going to be parseable (not null)
          if (typeof d.properties[property] === 'string') {
            // then parse them
            propertyData = JSON.parse(d.properties[property])
            // then ensure this is the right amount of data
            if (propertyData.length !== hourCount) {
              // if it's not, replace it with the fillerData
              propertyData = fillerData
            }
          }
          newProperties[property] = propertyData
        })
    
        // now replace the parsedProperties into the original object
        Object.assign(d.properties, newProperties)
    
        // cache the cells according to the resolution + demographic
        if (d.properties.occ[this.scalingHour] > 0) {
          // init the demographic cache if undefined
          if (!this.cells[transformationDemographic]) {
            this.cells[transformationDemographic] = { }
          }
          // init the resolution cache if undefined
          if (!this.cells[transformationDemographic][resolution]) {
            this.cells[transformationDemographic][resolution] = { }
          }

          // now cache things by their h3 id
          if (!this.cells[transformationDemographic][resolution][d.properties.h3]) {
            this.cells[transformationDemographic][resolution][d.properties.h3] = d.properties
            // if we've cached a new cell, we'll repaint after a few ms
            if (!this.transformTimeout) {
              this.transformTimeout = setTimeout(() => {
                this.repaint()
                this.transformTimeout = null
              }, 550)
            }
          }
        }
        return d
      })
      return newData
    }
  },

  /**
   * Creates (or updates) an MVT layer with a new fillColorFunc
   * puts the layer into the layers[id] to be added (or updated) in deck.gl
   * @param {[r, g, b, a] | (feature) => [r, g, b, a]} fillColorFunc an array of color, or a function with feature input and color array output
   */
  createMVTLayer (fillColorFunc) {
    // don't worry about creating the same MVT layer over and over again. deck.gl will smart-replace it based on id and changed properties
    fillColorFunc = fillColorFunc || [0, 0, 0, 0]

    const layerID = this.getLayerID()

    const dataTransform = this.createDataTransform()
    
    const config = this.demographicConfigs[this.getConfigID()]
    const anytimeLayer = Object.keys(config || {})[0]
    const url = config?.[anytimeLayer]?.url // where does the data come from

    this.layers[this.demographic] = new deck.MVTLayer({
      id: layerID,
      binary: false,
      pickable: true,
      data: url,
      getFillColor: fillColorFunc,
      getLineColor: [177, 177, 177, 12],
      lineWidthMinPixels: 1,
      dataTransform,
      minZoom: 0,
      maxZoom: 12,
      refinementStrategy: 'no-overlap',
      updateTriggers: {
        getFillColor: [this.demographic, this.periodMode, this.hour, this.mvtRepaint]
      }
    })
  },

  loadAnytimePopulation () {
    // we don't have a config or a map to load with
    if (!this.demographicConfigs[this.getConfigID()] || !this.map) {
      return
    }
    const layerID = this.getLayerID()
    // this layer already exists, just use that layer and move on
    if (this.map.getLayer(layerID)) {
      return
    }

    // load the MVT layer into the layers object
    this.createMVTLayer()

    // if the deck already exists, we can just update the layers
    if (this.deck) {
      this.deck.setProps({ layers: Object.values(this.layers) })
    } else {
      // otherwise we will create the deck
      // it needs the initialViewState to match the current map state otherwise you get a weird ghost map
      const { lng: longitude, lat: latitude } = this.map.getCenter()
      const zoom = this.map.getZoom()
      this.deck = new deck.Deck({
        gl: this.map.painter.context.gl,
        layers: Object.values(this.layers),
        initialViewState: { longitude, latitude, zoom }
      })
    }

    // deck.gl is updated, tell mapbox to add a layer that is the deck
    this.map.addLayer(new deck.MapboxLayer({ id: layerID, deck: this.deck }))

    // fix a bug where the deck will override the mapbox cursor
    // this makes deck.gl always have the same cursor as mapbox wants
    this.map.__deck.props.getCursor = () => this.map.getCanvas().style.cursor

    // we just added the layer, repaint it
    this.repaint()
  },

  // remove the active anytime population from mapbox and the layers cache
  removeAnytimePopulation () {
    const id = this.getLayerID()
    if (this.map.getLayer(id)) {
      this.map.removeLayer(id)
    }
    delete this.layers[this.demographic]
    if (this.deck) {
      this.deck.setProps({ layers: Object.values(this.layers) })
    }
  },

  // remove the old layers and load the new ones
  setDemographic (demographic) {
    if (this.demographic) {
      this.removeAnytimePopulation()
    }
    this.demographic = demographic
    if (demographic) {
      return this.loadConfig().then(() => {
        this.loadAnytimePopulation()
        return Promise.resolve()
      })
    } else {
      return Promise.resolve()
    }
  },

  init () {
    this.map = new mapboxgl.Map({
      accessToken: MAPBOX_TOKEN,
      container: 'map', // id of the map div
      style: MAPBOX_BASEMAP,
      zoom: 3.75,
      center: [-93, 38],
      minZoom: 0,
      maxZoom: 22,
      attributionControl: false // we'll add our own
    })

    // also includes the basic mapbox attribution
    this.map.addControl(new mapboxgl.AttributionControl({ customAttribution: '<a href="https://www.intermx.com/" target="_blank" rel="noopener">&copy; Insights by Motionworks</a>' }))

    // add +/- buttons on the top-left
    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')

    // other javascript files can subscribe to this, but set `styleLoaded` in case the other files are slower than the mapbox style
    this.map.on('style.load', () => {
      this.loadConfig().then(() => {
        this.loadAnytimePopulation()
      })
    })
  }
}

const anytimeMenu = {
  menu: null,
  open: true,
  demographicSelect: null,
  weekdaySelect: null,
  periodSelect: null,
  hourSelectContainer: null,
  hourSelect: null,
  collapseContainer: null,
  collapseOpenIcon: null,
  collapseCloseIcon: null,
  animationContainer: null,
  playButton: null,
  pauseButton: null,
  animationInterval: null,

  openMenu () {
    this.collapseOpenIcon.classList.remove('hidden')
    this.collapseCloseIcon.classList.add('hidden')
    this.menu.classList.remove('closed')
    this.open = true
  },
  closeMenu () {
    this.collapseOpenIcon.classList.add('hidden')
    this.collapseCloseIcon.classList.remove('hidden')
    this.menu.classList.add('closed')
    this.open = false
  },

  startAnimation () {
    this.animationInterval = setInterval(() => {
      anytimePopulation.hour = (anytimePopulation.hour + 1) % anytimePopulation.scalingHour
      this.hourSelect.value = String(anytimePopulation.hour)
      anytimePopulation.repaint()
    }, 500)
    this.playButton.classList.add('hidden')
    this.pauseButton.classList.remove('hidden')
  },
  stopAnimation () {
    clearInterval(this.animationInterval)
    this.animationInterval = null
    this.playButton.classList.remove('hidden')
    this.pauseButton.classList.add('hidden')
  },

  init () {
    this.menu = document.querySelector('#menu')
    this.demographicSelect = document.querySelector('#demographic-select')
    this.weekdaySelect = document.querySelector('#weekday-select')
    this.periodSelect = document.querySelector('#period-select')
    this.hourSelectContainer = document.querySelector('.hour-select-container')
    this.hourSelect = document.querySelector('#hour-select')
    this.collapseContainer = document.querySelector('.card-collapse-container')
    this.collapseOpenIcon = document.querySelector('.card-collapse.open')
    this.collapseCloseIcon = document.querySelector('.card-collapse.closed')
    this.animationContainer = document.querySelector('.animation-container')
    this.playButton = document.querySelector('.hour-animation.play')
    this.pauseButton = document.querySelector('.hour-animation.pause')

    anytimeUtils.demographicOptions.forEach(({ value, text }) => {
      const option = document.createElement('option')
      option.id = `demographic-${value}`
      option.value = value
      option.innerText = text
      option.selected = value === this.demographic
      this.demographicSelect.appendChild(option)
    })

    this.demographicSelect.addEventListener('change', evt => {
      anytimePopulation.setDemographic(evt.target.value)
    })

    this.weekdaySelect.addEventListener('change', evt => {
      anytimePopulation.dayType = evt.target.value
      anytimePopulation.setDemographic(anytimePopulation.demographic) // set to same demographic to reload with different week type
    })

    this.periodSelect.addEventListener('change', evt => {
      anytimePopulation.periodMode = evt.target.value
      this.stopAnimation()
      anytimePopulation.hour = 0
      if (anytimePopulation.periodMode === 'daily') {
        this.hourSelectContainer.classList.add('hidden')
      } else {
        this.hourSelectContainer.classList.remove('hidden')
      }
      this.hourSelect.value = String(anytimePopulation.hour)
      // anytimePopulation.animating = false
      anytimePopulation.repaint() // changing from daily to hourly only requires a repaint
    })

    this.hourSelect.addEventListener('change', evt => {
      anytimePopulation.hour = Number(evt.target.value)
      anytimePopulation.repaint()
    })

    this.collapseContainer.addEventListener('click', () => {
      this.open ? this.closeMenu() : this.openMenu()
    })

    this.animationContainer.addEventListener('click', () => {
      this.animationInterval ? this.stopAnimation() : this.startAnimation()
    })
  }
}

// run this javascript when the page is loaded
window.addEventListener('load', () => {
  anytimeMenu.init()
  anytimePopulation.init()
})