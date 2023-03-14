// $_.replace(" ",".").replace(/^$/,"__NULL__")

let endPoints;
let table = $("#table")
let dataBody = table.children("tbody");
let tableHeader = table.children("thead");
let endPointSelect = $("#endPointSelector");
let importFldMap = $("<select>").append("<option value=''>--Ignore--</option>");
let fldsNames = [];
let form = $("#form")[0];
let dataProcInput = $("<span style='width: 100px; overflow: hide;white-space: nowrap;'><input type='text'/></span>")
    .append(
        $("<button>")
            .text("~")
            .on("click",(event)=>processColumnData(event.target))
    );
let apiBaseUrl;

function updateOnDupe(src) {
    if($(src).val()==="update") {
        $("#confgFlds2Update").css("display","inline");
    }
    else {
        $("#confgFlds2Update").css("display","none");
    }
}

function toggleSelect(event) {
    let checkbox = $(event.target).parent("tr").find("input");
    checkbox.prop("checked",!checkbox.prop("checked"));
}

/**
 * load API specifications from URL
 */
function loadApiSpec() {
    $("#endPointSelectorView").addClass("d-none");
    $("#invalidApiSpec").addClass("d-none");
    apiBaseUrl = $("#apiBaseUrl").val();
    apiKey = $("#apiKey").val();
    apiSpecUrl = apiBaseUrl+"/config/structure?xApiKey="+apiKey
    $.get(apiSpecUrl)
    .then(function(data){
        endPoints = data;
        endPointSelect.empty().append('<option value="">Select endpoint</option>');
        Object.getOwnPropertyNames(endPoints).forEach(item => $("<option>").text(item).data("ep",endPoints[item]).appendTo(endPointSelect));
        $("#endPointSelectorView").removeClass("d-none");
    }).fail(()=>{
        $("#invalidApiSpec").removeClass("d-none");
    })
}

let transactions = [];

/**
 * import data into database
 */
function startImport() {
    let fldMapSelects = tableHeader.children(".map-row").find("select");
    let insStruct = {}

    for(let i=0;i<fldMapSelects.length;i++) {
        if($(fldMapSelects[i]).val()=="") continue;

        let sel = fldMapSelects[i];
        let $opt = $(sel.options[sel.selectedIndex]);
        let dt = $opt.data("spec");
        console.log(dt);
        insStruct[$opt.val()] = {
            idx: i,
            spec: dt
        }
    }
    console.log(insStruct);

    let insData = [];
    dataBody.children("tr").each(function(){
        let row = $(this);
        let chkBox = row.find("input[type=checkbox]");
        if(!$(row).find("input[type=checkbox]").prop("checked")) return;
        let item = {
            attributes: {},
            relationships:{}
        };
        let found = 0;
        Object.getOwnPropertyNames(insStruct).forEach((fldName)=>{
            let fld = insStruct[fldName];
            console.log(fld);
            found = 1;
            let idx = fld.idx+2;
            let val = row.find("td:nth-child("+idx+")").text();
            val = val==="__NULL__"?null:val;

            if(fld.spec.type=="field") {
                item.attributes[fld.spec.name] = val;
                return
            }
            
            if(typeof item.relationships[fld.spec.relation]==="undefined") {
                item.relationships[fld.spec.relation] = {};
                item.relationships[fld.spec.relation].data = fld.spec.reltype=="inbound"?[{attributes:{}}]:{attributes:{}};
            }
            if(fld.spec.reltype=="inbound") {
                item.relationships[fld.spec.relation].data[0].attributes[fld.spec.name] = val;
            }
            else {
                item.relationships[fld.spec.relation].data.attributes[fld.spec.name] = val;
            }
        
        })
        if(!Object.getOwnPropertyNames(item.relationships).length) {
            delete item.relationships;
        }
        if(found) insData.push(item);
    });
    if(!insData.length) return;
    insData = {
        data:insData
    }
    
    let onduplicate = $("#onduplicate").val();
    let url  = apiBaseUrl+"/data/"+$(endPointSelect).val() + "?onduplicate="+onduplicate + (onduplicate!=="update" ? "" : "&update="+$("#flds2update").val());
    console.log(url,insData,$(endPointSelect).val());
    //return;
    $.ajax({
        method: "post",
        data: JSON.stringify(insData),
        dataType: 'json',
        contentType: "application/json",
        url: url
    })
    .then(function(data){
        console.log(data);
        alert("success");
        $("#status").addClass("success").text("OK")
        setTimeout(() => {
            $("#status").removeClass("success").html("")
        }, 5000);
    })
    .catch(function(x){
        console.log(x);
        $("#status").addClass("fail").html(JSON.stringify(x.responseJSON.errors))
        setTimeout(() => {
            $("#status").removeClass("fail").html("")
        }, 5000);
    })

}
/**
 * 
 */
function processColumnData(src) {
    let expr = $(src).prev().val();
    expr = expr=="" ? "$_" : expr;
    let col = $(src).parents("th");
    console.log(col,expr);
    
    let i=0;
    let selfIdx;
    let cells = col.parent().children();

    for(let i=0;i<cells.length;i++) {
        if(col[0]==cells[i]) {
            selfIdx = i;
            break
        }
    }
    expr = expr.replace(/\$_/g,"$"+selfIdx);

    console.log(selfIdx);
    
    dataBody.children().each(function(){

        let cells = $(this).children()
        let vals = {};
        for(let i=0;i<cells.length;i++) {
            vals["$"+i] = $(cells[i]).data("val");
        }
        let currentCell = cells[selfIdx];
        console.log(vals);
        with(vals) {
            console.log($1);
            try {
                console.log(expr);
                let res = eval(expr);
                console.log(res);
                $(currentCell).text(res);
            }
            catch(e){
                console.log(e);
            }
        }
        
    })

}

/**
 * load API spcecifications
 */
function loadCsvFile() {
    resetTable();
    fldsNames = [];
    transactions = [];
    const file = form.file.files[0];
    const reader = new FileReader();

    let separator = form.separator.value;
    let delimiter = form.delimiter.value;
    let thnum = form.thnum.value;

    reader.onload = function (e) {
        transactions = [];
        const text = e.target.result;

        transactions = CSVToArray(text,separator);
        renderData();
        renderHeader();
    };

    reader.readAsText(file);
}

/**
 * update field mapping select
 */
function updateFldMapSelect() {
    let fldMapSelect = $("#endPointSelector");

    // no 
    if($(fldMapSelect).val()=="") {
        importFldMap = $("<select>").addClass("map").append("<option value=''>--Ignore--</option>");
        renderHeader([]);
        return;
    }

    let sel = endPointSelect[0];
    let spec = $(sel.options[sel.selectedIndex]).data("ep");
    console.log(spec);

    importFldMap = $("<select>").append("<option value=''>--Ignore--</option>");
    let fldNames = Object.getOwnPropertyNames(spec.fields);
    if(fldNames.length) {
        fldNames.forEach((fldName)=>{
            console.log(spec.fields[fldName]);
            let fk = spec.fields[fldName]["foreignKey"];
            $("<option>").text(fldName + (fk ? ("(->"+fk.table+"."+fk.field+")"):"" ))
                .val(fldName)
                .appendTo(importFldMap)
                .data("spec",{
                        spec: spec.fields[fldName],
                        name: fldName,
                        type: "field"
                    }
                );
        });
    }

    let relNames = Object.getOwnPropertyNames(spec.relations);
    if(relNames.length) {
        relNames.forEach((relName)=>{
            //if(spec.relations[relName].type==="inbound") return;
            let relTable = endPoints[spec.relations[relName].table];
            let relFldsNames = Object.getOwnPropertyNames(relTable.fields);

            if(!relFldsNames.length) return;
            let grp = $("<optgroup>").prop("label",relName + " / fields").appendTo(importFldMap);

            relFldsNames.forEach((fldName)=>{
                $("<option>").val(relName+'.'+fldName).text(relName+'.'+fldName)
                    .appendTo(grp)
                    .data("spec",{
                        type: "relation",
                        reltype: spec.relations[relName].type,
                        relation:relName,
                        name: fldName,
                        spec: relTable.fields[fldName]
                    });
            });
        });
    }

    //$("#demo").empty().append(importFldMap);
    
    renderHeader();
    renderData();

    // let theadTrs = table.children("thead").children();
    // if(table.children("thead").children().length) {
    //     $(theadTrs[2]).children().each(function(){
    //         $(this).empty().append($(importFldMap).clone(true,true))
    //     })
    // }

}

/**
 * toggle selectHeaderRow mode;
 * allow the selection of header row by point&click
 */
function toggleHeadRowSelection(src){
    if($(src).hasClass("active")) {
        $(src).removeClass("active");
        $("tbody").removeClass("selectMode");
    }
    else{
        $("tbody").addClass("selectMode").children().on("click",(event)=>{
            let tmp = transactions.splice(0,$(event.currentTarget).data("idx")+1);
            fldsNames = tmp.pop();
            renderData();
            renderHeader();
            console.log(event,$(event.currentTarget).data("idx"));
            
            toggleHeadRowSelection(src);
        });
        $(src).addClass("active");
    }
}
function addFilter(src) {
    $(src).parent().children("input").val($(src).val());
    filterData();
}
function filterData() {
    let filterTerms = {};
    $("#filterRow").find("input").each(function(){
        if(this.value!=="") {
            try {
                filterTerms[$(this).data("idx")] = new RegExp(this.value);
            }
            catch(e) {
                console.log(e);
            }
        }
    });
    let filterTermsIdx = Object.getOwnPropertyNames(filterTerms)
    dataBody.children().each(function(){
        let dataRow = $(this);
        let match = true;
        filterTermsIdx.forEach(function(idx){
            let searchRgx = filterTerms[idx];
            idx = idx*1+1;
            match = match && (dataRow.children("td:nth-child("+idx+")").text().search(searchRgx)!==-1)
        });
        if(match) {
            dataRow.removeClass('hidden').addClass('visible');
        }
        else {
            dataRow.addClass('hidden').removeClass('visible').find("input[type=checkbox]").prop("checked",false);
        }
    })
}
/**
 * render header 
 */ 
function renderHeader() {
    let thead = table.children("thead").empty();
    if(!fldsNames.length) {
        return;
    }

    let idxRow = $("<tr>").appendTo(thead)
        .addClass("idx-row")
        .append($("<th>").append($("<input type='checkbox'>").on("click",toggleSelectDataRows2Import)));

    let labelsRow = $("<tr>").addClass("labels-row").append($("<th>").text("Col names")).appendTo(thead);

    let filterRow = $("<tr>").addClass("filter-row").append($("<th>").text("Filter")).appendTo(thead).prop("id","filterRow");
    console.log(filterRow);
    
    let fldTypesRow = $("<tr>").addClass("map-row").append($("<th>").text("Map")).appendTo(thead);

    let fldProcRow = $("<tr>").addClass("proc-row").append($("<th>").text("Proc")).appendTo(thead);
    // let onDuplicateRow = $("<tr>").append($("<th>").text("Proc")).appendTo(thead);
    
    
    let idx = 0;
    fldsNames.forEach((fld)=>{
        idx++;
        // IDX cold
        $("<th>").text(idx).appendTo(idxRow).on("click",toggleColCollapse);
        // FLD name col
        $("<th>").text(fld).appendTo(labelsRow);
        // filter col
        $("<th>").appendTo(filterRow).append($("#filterTemplates").clone(true)).append($("<input>").on("keyup",filterData).data("idx",idx));
        // fldMap col
        $("<th>").append($(importFldMap).clone(true,true)).appendTo(fldTypesRow);
        // fld process col
        $("<th>").html(dataProcInput.clone(true,true)).appendTo(fldProcRow);
    });
    let xtraColButton = $("<button>+</button>").on("click",addCustomCol)
    $("<th rowspan='5'>").appendTo(idxRow).append(xtraColButton);
}

function toggleColCollapse(event) {
    let $tgt = $(event.target);
    let idx = $tgt.text()*1+1;
    let $table = $tgt.parents();
    console.log(table,idx);
    if($tgt.hasClass("collapsed")) {
        $table.find("tbody>tr>td:nth-child("+idx+")").removeClass("collapsed");
        $table.find("thead>tr>th:nth-child("+idx+")").removeClass("collapsed");
    }
    else { 
        $table.find("tbody>tr>td:nth-child("+idx+")").addClass("collapsed");
        $table.find("thead>tr>th:nth-child("+idx+")").addClass("collapsed");
    }
}

/**
 * Add custom column
 */
function addCustomCol() {
    let thead = table.children("thead");
    let idxTh = $("<th>").insertBefore(thead.children()[0].lastChild);
    let idx = idxTh.parent().children().length-2;
    idxTh.text(idx)
    $("<th>").appendTo(thead.children()[1]).append();
    $("<th>").appendTo(thead.children()[2]).append($("<input>").on("keyup",filterData).data("idx",idx))
    $("<th>").appendTo(thead.children()[3]).append($(importFldMap).clone(true,true));
    $("<th>").appendTo(thead.children()[4]).html(dataProcInput.clone(true,true));

    let tbody = table.children("tbody");
    tbody.children().each(function(){
        $(this).append("<td>");
    })

}

/**
 * select/unselect all data rows
 */
function toggleSelectDataRows2Import(event) {
    let src = event.currentTarget;
    console.log(dataBody.find("tr[style=''] input"));
    dataBody.find("tr.visible input").prop("checked",src.checked)
}

/**
 * reset table
 */
function resetTable() {
    dataBody.empty();
    tableHeader.empty();
}


/**
 * render data
 */
function renderData() {
    let tbody = table.children("tbody").empty();
    let i=0;
    let maxColNum = 0;
    for(let i=0;i<transactions.length; i++) {
        let transaction = transactions[i];
        let row = $("<tr>").appendTo(tbody).data("el",transaction).data("idx",i).addClass("visible");
        $("<td>").append("<input type='checkbox'>").appendTo(row);
        transaction.forEach(cell=>$("<td>").text(cell).appendTo(row).data("val",cell));
        let len = row.children().length-1;
        if(len>=maxColNum) maxColNum = len;
    }
    
    console.log(fldsNames,maxColNum);
    if(fldsNames.length==0) {
        for(let i=1;i<=maxColNum;i++) {
            fldsNames.push('');
        }
        renderHeader();
    }
}
