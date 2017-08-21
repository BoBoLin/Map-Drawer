
//後端處理資料庫存取之php
var back_ip = "http://140.116.245.84/geo/Drawer/db_connect.php";

$(document).ready(function () {
	/********* auto import ***********/
    /*
    當分享完後得到的url, parse出id向database拿到此id的kml資訊
    */
    var href = location.href;
    var split_href;
    var kml_id;
    if(location.href.indexOf("?") > 0)
    {
        split_href = href.split('?');
        kml_id = split_href[1];

        var formData = {type: "read", id: kml_id}
        $.ajax({
            url: back_ip,
            type: "POST",
            data: formData,
            dataType: 'jsonp',
            jsonpCallback: 'handler',
            success: function(response) {
                console.log(response);
                if(response.kml == null)  //如果id不在資料庫中, reload map首頁
                {
                    alert("The information hasn't saved.");
                    //reload main web
                    window.location.href = "http://140.116.245.84/git/Map-Drawer-Web/drawer.html";
                }

                else
                    import_kml_string(response.kml);
            },
            error: function (jqXHR, textStatus, errorThrown)
            {
                console.log(textStatus, errorThrown);
            }
        });
    }
    else
    {
        kml_id = 0;
    }
    /********* !auto import ***********/


    /*************** export KML **************/
    var exportKMLElement = document.getElementById('export-kml');
    exportKMLElement.addEventListener('click', function(e) {
        var vectorSource = featureOverlay.getSource();
        var features = [];
        var myTexts = [];
        vectorSource.forEachFeature(function(feature) {
            var text = feature.getStyle().getText().getText();
            var pos = getPosition(feature);
            var rotation = feature.getStyle().getText().getRotation();
            var myText = {text:text,pos:pos,rotation:rotation};
            myTexts.push(myText);
            features.push(feature);
        });
        var format = new ol.format.KML();
        var kml_str = format.writeFeatures(features);
        var doc = $.parseXML(kml_str);
        var objs = $(doc).find("Placemark");
        for(var i=0;i<objs.size();i++){
            //add empty iconstyle (to prevent have pin.png in google earth)
            var iconStyleLength = $(objs[i]).find("IconStyle").length;
            if(iconStyleLength==0){
                $(objs[i]).find("Style").append("<IconStyle><Icon></Icon></IconStyle>");
            }
            // add text rotation
            var rotation = getRotation(myTexts,objs[i]);
            $(objs[i]).find("Style").append("<MyRotationStyle>"+rotation+"</MyRotationStyle>");
        }
        var output = $(doc).find("kml").prop('outerHTML');
        var base64 = btoa(unescape(encodeURIComponent(output)));

        exportKMLElement.href = 'data:application/vnd.google-earth.kml+xml;base64,' + base64;
    }, false);

    /*************** !export KML **************/


    /*************** import KML *************/
    $("#import-kml").change(function(){
        var uploader_dom = document.getElementById('import-kml');
        var kml_str = "";
        var reader = new FileReader();
        reader.onload = function (event) {
            // read feature to layer
            kml_str = event.target.result;
            import_kml_string(kml_str);
        };
        reader.readAsText(uploader_dom.files[0]);
    });

    /*************** !import KML *************/

});

function import_kml_string(kml_str) {
    var format = new ol.format.KML();
    featureOverlay.getSource().addFeatures(format.readFeatures(kml_str));
    featureOverlay.setMap(map);
    var doc = $.parseXML(kml_str);
    var objs = $(doc).find("Placemark");
    var isGE = $(doc).find("StyleMap").length; // if true, then file from google earth 
    for(var i=0;i<objs.size();i++){
        var rootTag = getRootTag(isGE,doc,objs[i]);  
        var styleId = getStyleId(isGE,doc,objs[i]); 
        type = getType(objs[i]);
        // icon style
        isIcon = getIsIcon(type,rootTag,styleId);
        icon_url = getIconUrl(isIcon,rootTag,styleId);
        // line style
        line_color = getLineColor(type,rootTag,styleId);
        line_width = getLineWidth(type,rootTag,styleId);
        // polygon style
        plane_color = getPlaneColor(type,rootTag,styleId);
        // text style        
        text_content = $(objs[i]).find("name").text();
        text_color = getTextColor(rootTag,styleId);
        text_size = getTextSize(rootTag,styleId);
        text_rotation = getTextRotation(isGE,rootTag);
        var consoleText = [text_content,text_color,text_size,text_rotation];
        // get feature by coordinate and set feature's style
        var coorstr = $(objs[i]).find("coordinates").text();    
        var coorXYarr = getCoorXYarr(coorstr);
        var features = featureOverlay.getSource().getFeatures();
        var feature = getFeatureByCoor(features,coorXYarr); 
        var s = getMyKMLstyle();
        feature.setStyle(s);
        // make feature editable
        var draw_type = getDrawType(type);
        var $cnt = i;
        feature.setId(draw_type+" "+$cnt);
        /*
        var feature_id = feature.getId();
        console.log(feature_id);
        console.log(feature);
        console.log(featureOverlay.getSource().getFeatureById(feature_id));
        */
        // add to editor
        $("#editor > tbody").append(
            "<tr>" +
                "<td>" +
                    "<h2 class='ui center aligned header'>" + i + "</h2>" +
                    "<div style='display: none;'>" + (draw_type + " " + $cnt) + "</div>" +
                "</td>" +
                "<td>" +
                    "<i class='" + ((draw_type=="line")? "arrow left" : (draw_type=="polygon")? "square outline" : (draw_type=="warning_sign")? "warning sign" : draw_type) + " icon'></i>" +
                    "(" + text_content + ")" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon search button'><i class='search icon'></i></button>" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon edit button'><i class='edit icon'></i></button>" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon remove button'><i class='remove icon'></i></button>" +
                "</td>" +
            "</tr>"
        );        
    }
/*
    for(var i=0;i<objs.size();i++){
        var id = $(objs[i]).attr("id");
        setDefaultFeatures();
        switch((id.split(' '))[0]){
            case 'font':
                type = "Point";
                text_content = $(objs[i]).find("name").text();
                text_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LabelStyle").find("color").text());
                text_size = $(x).find("myText[id=\""+id+"\"]").attr("size");
                text_rotation = parseFloat($(x).find("myText[id=\""+id+"\"]").attr("rotation"));
                isIcon = false;
            break;
            case 'line':
                type = "LineString";
                text_content = $(objs[i]).find("name").text();
                text_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LabelStyle").find("color").text());
                text_size = $(x).find("myText[id=\""+id+"\"]").attr("size");
                text_rotation = parseFloat($(x).find("myText[id=\""+id+"\"]").attr("rotation"));
                isIcon = false;
                line_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LineStyle").find("color").text());
                line_width = parseInt($(objs[i]).find("Style").find("LineStyle").find("width").text());
            break;
            case 'polygon':
                type = "Polygon";
                text_content = $(objs[i]).find("name").text();
                text_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LabelStyle").find("color").text());
                text_size = $(x).find("myText[id=\""+id+"\"]").attr("size");
                text_rotation = parseFloat($(x).find("myText[id=\""+id+"\"]").attr("rotation"));
                isIcon = false;
                line_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LineStyle").find("color").text());
                line_width = parseInt($(objs[i]).find("Style").find("LineStyle").find("width").text());
                plane_color = hexToRgbA(kmlColorCodeToHex($(objs[i]).find("Style").find("PolyStyle").find("color").text()));
            break;
            case 'home':
            case 'h':
            case 'warning_sign':
                type = "Point";
                text_content = $(objs[i]).find("name").text();
                text_color = kmlColorCodeToHex($(objs[i]).find("Style").find("LabelStyle").find("color").text());
                text_size = $(x).find("myText[id=\""+id+"\"]").attr("size");
                text_rotation = parseFloat($(x).find("myText[id=\""+id+"\"]").attr("rotation"));
                isIcon = true;
                icon_url = $(objs[i]).find("Style").find("IconStyle").find("Icon").find("href").text();
            break;
        }
       
        var s = new ol.style.Style({
            image: getImage(),
            stroke: new ol.style.Stroke({
                color: line_color,
                width: line_width,
            }),
            fill: new ol.style.Fill({
                color: plane_color,
            }),
            text: new ol.style.Text({
                scale: text_size,
                fill: new ol.style.Fill({ color: text_color }),
                rotation: text_rotation,
                text: text_content,
                offsetY: -10
            })
        });
        var feature = featureOverlay.getSource().getFeatureById(id);
        feature.setStyle(s);      
        var draw_type = (id.split(' '))[0];
        var $cnt = (id.split(' '))[1];
        // add to editor
        $("#editor > tbody").append(
            "<tr>" +
                "<td>" +
                    "<h2 class='ui center aligned header'>" + i + "</h2>" +
                    "<div style='display: none;'>" + (draw_type + " " + $cnt) + "</div>" +
                "</td>" +
                "<td>" +
                    "<i class='" + ((draw_type=="line")? "arrow left" : (draw_type=="polygon")? "square outline" : (draw_type=="warning_sign")? "warning sign" : draw_type) + " icon'></i>" +
                    "(" + text_content + ")" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon search button'><i class='search icon'></i></button>" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon edit button'><i class='edit icon'></i></button>" +
                "</td>" +
                "<td>" +
                    "<button class='ui icon remove button'><i class='remove icon'></i></button>" +
                "</td>" +
            "</tr>"
        );
    };
*/
    // draw on map
    var load_interaction = new ol.interaction.Modify({
        features: new ol.Collection(featureOverlay.getSource().getFeatures())
    });
    map.addInteraction(load_interaction);
}

function getRotation(myTexts,obj){
    var rotation = 0;
    for1:for(var i=0;i<myTexts.length;i++){
        var text = $(obj).find("name").text();
        if(text!=myTexts[i]["text"]){ // check text
            //console.log("text not match");
            continue;
        }
        var coorstr = $(obj).find("coordinates").text();    
        var coorXYarr = getCoorXYarr(coorstr);

        if(coorXYarr.length!=myTexts[i]["pos"].length){
            //console.log("position length not match");
            continue;
        }
        for(var j=0;j<coorXYarr.length;j++){ // check position
            if(coorXYarr[j][0]!=myTexts[i]["pos"][j][0]){
                //console.log("pos 0 not match");
                continue for1;
            }
            if(coorXYarr[j][1]!=myTexts[i]["pos"][j][1]){
                //console.log("pos 1 not match");
                continue for1;
            }
        }
        rotation = myTexts[i]["rotation"];
    }  
    return rotation;      
}

function getStyleId(isGE,doc,obj){
    var styleId;
    if(isGE>0){ //kml format is from google earth
        var styleUrl_0 = $(obj).find("styleUrl").text().replace("#","");
        var pair = $(doc).find("StyleMap[id="+styleUrl_0+"] > Pair");
        var styleUrl_1 = $(pair[0]).find("styleUrl").text().replace("#","");    
        styleId  = "[id="+styleUrl_1+"]";           
    }
    else{ //kml format is from openlayer
        styleId = "";
    }    
    return styleId;
}

function getRootTag(isGE,doc,obj){
    var rootTag;
    if(isGE>0){ //kml format is from google earth
        rootTag = doc;         
    }  
    else{ //kml format is from openlayer
        rootTag = obj;
    }  
    return rootTag;
}

function getCoorXYarr(coorstr){
    var coorXYZarr = coorstr.split(" ");
    var coorXYarr = [];
    for(var i=0;i<coorXYZarr.length;i++){
        var t = coorXYZarr[i].split(",");
        var X = $.trim(t[0]);
        var Y = $.trim(t[1]);
        if(X==""||Y==""){
            continue;
        }
        var coorXY = [X,Y];
        coorXYarr.push(coorXY);
    }
    return coorXYarr;       
}

function getFeatureByCoor(features,coorXYarr){
    for2: for(var i=0;i<features.length;i++){
        var fCoor = getPosition(features[i]);
        if(fCoor.length!=coorXYarr.length){
            //console.log("array length not match");
            continue;
        }
        for(var j=0;j<fCoor.length;j++){
            if(fCoor[j][0]!=parseFloat(coorXYarr[j][0]) ){
                //console.log("pos 0 not match");
                continue for2;
            }
            if(fCoor[j][1]!=parseFloat(coorXYarr[j][1]) ){
                //console.log("pos 1 not match");
                continue for2;
            }
        }
        return features[i];
    }
}

function getPosition(feature){
    var type = feature.getGeometry().getType();
    var pos;
    if(type=="Point"){
        pos = [feature.getGeometry().getCoordinates()];
    }
    else if(type=="Polygon"){
        pos = feature.getGeometry().getCoordinates()[0];         
    }
    else{
        pos = feature.getGeometry().getCoordinates();      
    }
    return pos;
}

function getTextColor(rootTag,styleId){
    var text_color;
    var kmlColorCodeLength = $(rootTag).find("Style"+styleId+" > LabelStyle > color").length;
    if(kmlColorCodeLength==0){
        text_color = "#000000";
    }
    else{
        text_color = kmlColorCodeToHex($(rootTag).find("Style"+styleId+" > LabelStyle > color").text());
    }
    return text_color;
}

function getTextSize(rootTag,styleId){
    var text_size;
    var textScaleLength = $(rootTag).find("Style"+styleId+" > LabelStyle > scale").length;
    if(textScaleLength==0){
        text_size = 1;
    }
    else{
        text_size = parseFloat($(rootTag).find("Style"+styleId+" > LabelStyle > scale").text());
    }  
    return text_size;    
}

function getType(obj){
    var isPoint = $(obj).find("Point").length;
    var isLineString = $(obj).find("LineString").length;
    var isPolygon = $(obj).find("Polygon").length; 
    var type;
    if(isPoint){
        type = "Point";
    }
    else if(isLineString){
        type = "LineString";
    }
    else if(isPolygon){
        type = "Polygon";
    }
    else{
        type = "";
        console.log("type is not Point or LineString or Polygon");
    }
    return type;
}

function getIsIcon(type,rootTag,styleId){
    var iconUrlLength;   
    if(type=="Point"){ 
        iconUrlLength = $(rootTag).find("Style"+styleId+" > IconStyle > Icon > href").length;   
    }
    else{
       iconUrlLength = 0; 
    } 
    var isIcon;
    if(iconUrlLength>0){
        isIcon = true;
    }    
    else{
        isIcon = false;
    }
    return isIcon;  
}

function getIconUrl(isIcon,rootTag,styleId){
    var icon_url;
    if(isIcon){
        icon_url = $(rootTag).find("Style"+styleId+" > IconStyle > Icon > href").text();                 
    } 
    else{ // default url to prevent error
        icon_url = "https://openlayers.org/en/v4.1.1/examples/data/icon.png";
    }     
    return icon_url;
}

function getLineColor(type,rootTag,styleId){
    var line_color;
    if(type=="LineString"||type=="Polygon"){
        line_color = kmlColorCodeToHex($(rootTag).find("Style"+styleId+"> LineStyle > color").text());
    }
    else{ //default color is black to prevent error
        line_color = "#ffffff";
    }
    return line_color;
}

function getLineWidth(type,rootTag,styleId){
    var line_width;
    if(type=="LineString"||type=="Polygon"){
        line_width = parseInt($(rootTag).find("Style"+styleId+"> LineStyle > width").text());
    }
    else{ //default width is 0 to prevent error
        line_width = 0;
    }
    return line_width;
}

function getPlaneColor(type,rootTag,styleId){
    var plane_color;
    if(type=="Polygon"){
        plane_color = hexToRgbA(kmlColorCodeToHex($(rootTag).find("Style"+styleId+" > PolyStyle > color").text())); 
    }
    else{ //default color to prevent error
        plane_color = "rgba(0, 0, 0, 0)";
    }
    return plane_color;
}

function getTextRotation(isGE,rootTag){
    var text_rotation;
    if(isGE){ // google earth
        text_rotation = 0;
    }
    else{ // openlayer
        text_rotation = parseFloat($(rootTag).find("Style > MyRotationStyle").text());
    }
    return text_rotation;
}

function getMyKMLstyle(){
    var s = new ol.style.Style({
        image: getImage(),
        stroke: new ol.style.Stroke({
            color: line_color,
            width: line_width,
        }),
        fill: new ol.style.Fill({
            color: plane_color,
        }),
        text: new ol.style.Text({
            scale: text_size,
            fill: new ol.style.Fill({ color: text_color }),
            rotation: text_rotation,
            text: text_content,
            offsetY: -10
        })
    });  
    return s;  
}

function getDrawType(type){
    var draw_type;
    if(type=="Point"){
        draw_type = "font";
    }
    else if(type=="LineString"){
        draw_type = "line";
    }
    else if(type=="Polygon"){
        draw_type = "polygon";
    }
    else{
        console.log("no draw type");
    }
    return draw_type;
}