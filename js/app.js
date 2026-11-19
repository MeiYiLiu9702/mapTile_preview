// 加入 pmtiles protocol
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile); 

// 加入底圖
const baseStyle = {
	version:8,
	sources:{
		// 加入臺灣通用版電子地圖
		'nlsc-emap':{
			type:'raster',
			tiles:['https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}'],
			tileSize: 256,
			attribution: '&copy; 內政部國土測繪中心'
		}
	},
	layers:[
		{
			id: 'nlsc-emap',
			type: 'raster',
			source: 'nlsc-emap'
		}]
};

// 建立地圖
const map = new maplibregl.Map({
	container: 'map',
	style: baseStyle,
	// style: 'https://tiles.openfreemap.org/styles/liberty',
	center: [120.9, 23.7],
	zoom:8
}); 

// 加入地圖上的物件
map.addControl(new maplibregl.NavigationControl(), 'top-right' );



// 選擇資料夾
const folderInput = document.getElementById("folder-select");
const statusText = document.getElementById("status");
const layerList = document.getElementById("layer-list"); 

// 圖層顏色
const colors = ['#e4572e', '#2e86ab', '#76b041', '#a23b72', '#f18f01', '#17bebb'];

// 已載入的圖層
let loadedLayers = [];

folderInput.addEventListener('change', function(event){
	clearLayers(); 
	const allFiles = Array.from(event.target.files);
	const pmtilesFiles = allFiles.filter(function(file){
		return file.name.toLowerCase().endsWith('.pmtiles');  
	});
	console.log(pmtilesFiles);
	statusText.textContent = `已讀到 ${pmtilesFiles.length} 個 PMTiles`;

	pmtilesFiles.forEach(function(file, index){ 
		loadPmtiles(file, index); 
	}); 
}); 




// 讀取一個 PMTile 並加到 map 畫面上
async function loadPmtiles(file, index){
	// 1. 檔案加入 PMtile 協定
	const archive = new pmtiles.PMTiles(new pmtiles.FileSource(file));
	protocol.add(archive); 

	// 2. 讀取檔案 header 與 metadata
	const header = await archive.getHeader();
	const metadata = await archive.getMetadata();
	console.log(file.name, header, metadata);

	// 3. 加入來源
	const sourceId = 'pmtiles-'+ index;
	map.addSource(sourceId,{
		type: 'vector',
		url: 'pmtiles://'+file.name
	}); 

	const color = colors[index % colors.length];
	const layerIds = [];

	// 4. 匯入的 vector 各自加一個填滿的顏色與邊框
	metadata.vector_layers.forEach(function(vectorLayer){
		const fillId = sourceId + '-'+ vectorLayer.id +'-fill';
		const lineId = sourceId + '-'+ vectorLayer.id +'-line';
		
		// 填滿的顏色
		map.addLayer({
			id: fillId, 
			type: 'fill',
			source: sourceId,
			'source-layer': vectorLayer.id,
			paint:{
				'fill-color': color,
				'fill-opacity': 0.3
			}
		}); 

		map.addLayer({
			id: lineId, 
			type: 'line',
			source: sourceId,
			'source-layer': vectorLayer.id,
			paint:{
				'line-color': color,
				'line-width':0.8
			}
		}); 
		layerIds.push(fillId, lineId); 
	});

	// 5. 加入圖層清單
	const bounds = [[header.minLon, header.minLat], [header.maxLon, header.maxLat]];
	const record = {
		name: file.name,
		sourceId: sourceId,
		layerIds: layerIds,
		color: color,
		bounds: bounds
	};
	loadedLayers.push(record);
	addLayerItem(record); 

	// 縮放到資料範圍
	map.fitBounds(
		bounds, {padding: 40}
	); 
}




// 在面板上加一個圖層項目
function addLayerItem(record) {
        const li = document.createElement('li');
        li.className = 'layer-item';
        li.innerHTML = `
                <div class="layer-row">
                        <input type="checkbox" checked>
                        <span class="swatch" style="background: ${record.color}"></span>
                        <span class="layer-name" title="${record.name}">${record.name}</span>
                        <button type="button">縮放</button>
                </div>
        `;
		//  <label class="opacity-row">
        //                 透明度
        //                 <input type="range" min="0" max="1" step="0.05" value="0.3">
        //         </label> 
        const checkbox = li.querySelector('input[type="checkbox"]');
        const zoomButton = li.querySelector('button');
        const slider = li.querySelector('input[type="range"]');

        // 顯示 / 隱藏
        checkbox.addEventListener('change', function () {
                const visibility = checkbox.checked ? 'visible' : 'none';
                record.layerIds.forEach(function (id) {
                        map.setLayoutProperty(id, 'visibility', visibility);
                });
        });

        // 縮放到範圍
        zoomButton.addEventListener('click', function () {
                map.fitBounds(record.bounds, { padding: 40 });
        });

        // 透明度（只調整填色） (跟前端的 id=opacity-low 物件連動) 
//         slider.addEventListener('input', function () {
//                 record.layerIds.forEach(function (id) {
//                         if (map.getLayer(id).type === 'fill') {
//                                 map.setPaintProperty(id, 'fill-opacity', Number(slider.value));
//                         }
//                });
//         });

        layerList.appendChild(li);
}

// 移除所有已載入的圖層（重新選擇資料夾時使用）
function clearLayers() {
        loadedLayers.forEach(function (record) {
                record.layerIds.forEach(function (id) {
                        map.removeLayer(id);    // 先移除 layer
                });
                map.removeSource(record.sourceId);   // 再移除 source
        });
        loadedLayers = [];
        layerList.innerHTML = '';
}
