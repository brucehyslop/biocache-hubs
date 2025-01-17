/* 
 *  Copyright (C) 2011 Atlas of Living Australia
 *  All Rights Reserved.
 *
 *  The contents of this file are subject to the Mozilla Public
 *  License Version 1.1 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of
 *  the License at http://www.mozilla.org/MPL/
 *
 *  Software distributed under the License is distributed on an "AS
 *  IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 *  implied. See the License for the specific language governing
 *  rights and limitations under the License.
 *
 */
//= require searchCore.js
//= require_self

// Jquery Document.onLoad equivalent
$(document).ready(function() {

    // jQuery.i18n.properties was removed, as it already loaded on the seach page via 'biocache-hubs.js' file
    // which requires jQuery.i18n.properties to be loaded earlier for leaflet plugin. NdR Nov 2018.

    //alert("doc is loaded");
    // listeners for sort & paging widgets
    var excludeCounts = {};
    $.get(BC_CONF.excludeCountUrl).done(function(data) {
        $('.exclude-loader').hide();
        for (var key in data) {
            var categoryEnabled = $('.exclude-count-label[data-category='+key+']').data('enabled')
            data[key] = categoryEnabled ? (new Intl.NumberFormat()).format(parseInt(data[key])) : '0';
            $('.exclude-count-label[data-category='+key+']').text(data[key]).show();

            if (data[key] === '0') {
                $('.exclude-count-facet[data-category=' + key + ']').text('(' + data[key] + ')').show();
            } else {
                $('.exclude-count-facet[data-category=' + key + ']').text('(-' + data[key] + ')').show();
            }
        }
        excludeCounts = data;
    });
    $("select#sort").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('sort',val);
    });
    $("select#dir").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('dir',val);
    });
    $("select#sort").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('sort',val);
    });
    $("select#dir").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('dir',val);
    });
    $("select#per-page").change(function() {
        var val = $("option:selected", this).val();
        reloadWithParam('pageSize',val);
    });

    // Jquery Tools Tabs setup
    var tabsInit = {
        map: false,
        charts: false,
        userCharts: false,
        images: false,
        species: false
    };


    // initialise BS tabs
    $('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
        //console.log("this", $(this).attr('id'));
        var id = $(this).attr('id');
        var tab = e.currentTarget.hash.substring(1);
        amplify.store('search-tab-state', tab);
        location.hash = 'tab_'+ tab;

        if (id == "t2" && !tabsInit.map) {
            //console.log("tab2 FIRST");
            initialiseMap();
            tabsInit.map = true; // only initialise once!
        } else if (id == "t3" && !tabsInit.charts) {
            // trigger charts load
            loadDefaultCharts();
            tabsInit.charts = true; // only initialise once!
        } else if (id == "t6" && !tabsInit.userCharts) {
            // trigger charts load
            loadUserCharts();
            tabsInit.userCharts = true; // only initialise once!
        } else if (id == "t4" && !tabsInit.species) {
            loadSpeciesInTab(0, "common");
            tabsInit.species = true;
        } else if (id == "t5" && !tabsInit.images && BC_CONF.hasMultimedia) {
            loadImagesInTab();
            tabsInit.images = true;
        }
    });

    var storedSearchTab = amplify.store('search-tab-state');

    // work-around for intitialIndex & history being mutually exclusive
    if (!storedSearchTab && BC_CONF.defaultListView && !window.location.hash) {
        window.location.hash = BC_CONF.defaultListView; // used for avh, etc
    }

    // catch hash URIs and trigger tabs
    if (location.hash !== '') {
        $('.nav-tabs a[href="' + location.hash.replace('tab_','') + '"]').tab('show');
        //$('.nav-tabs li a[href="' + location.hash.replace('tab_','') + '"]').click();
    } else if (storedSearchTab) {
        //console.log("stored value", storedSearchTab);
        $('.nav-tabs a[href="#' + storedSearchTab+ '"]').tab('show');
    } else {
        $('.nav-tabs a:first').tab('show');
    }

    // remove *:* query from search bar
    //var q = $.url().param('q');
    var q =  $.url().param('q');
    if (q && q[0] == "*:*") {
        $(":input#solrQuery").val("");
    }

    // active facets/filters

    // bootstrap dropdowns - allow clicking inside dropdown div
    $('#facetCheckboxes').children().not('#updateFacetOptions').click(function(e) {
        //console.log("detected a Click");
        e.stopPropagation();
    });

    // in mobile view toggle display of facets
    $("#toggleFacetDisplay").click(function() {
        $(this).find("i").toggleClass("icon-chevron-down icon-chevron-right");
        if ($(".sidebar").is(":visible")) {
            $(".sidebar").removeClass("overrideHide");
        } else {
            $(".sidebar").addClass("overrideHide");
        }
    });

    // user selectable facets...
    $("input.facetOpts").change(function() {
        var selectedFacets = 0;
        $('#facetConfigErrors').html('').hide();

        //var val = $("option:selected", this).val();
        // count selected facets to check if facets.max has been exceeded
        $('input.facetOpts:checkbox:checked').each(function(){
            selectedFacets++;
        });

        if (BC_CONF.maxFacets && BC_CONF.maxFacets > 0 && selectedFacets > BC_CONF.maxFacets) {
            $('#facetConfigErrors').html(jQuery.i18n.prop('facets.max.exceeded', (selectedFacets - BC_CONF.maxFacets))).show();
        }
    });

    $("#updateFacetOptions").click(function(e) {
        e.preventDefault();
        // alert("about to reload with new facets...");
        var selectedFacets = [];
        // iterate over seleted facet options
        $(":input.facetOpts:checked").each(function(i, el) {
            selectedFacets.push($(el).val());
        });

        //Check user has selected at least 1 facet
        if (selectedFacets.length > 0 && selectedFacets.length  <= BC_CONF.maxFacets) {
            // save facets to the user_facets cookie as string
            $.cookie.json = false;
            $.cookie("user_facets", selectedFacets, { expires: 7 });
            // reload page
            document.location.reload(true);
        } else if (selectedFacets.length > BC_CONF.maxFacets) {
            alert(jQuery.i18n.prop('facets.max.exceeded', (selectedFacets.length - BC_CONF.maxFacets)));
        } else {
            alert(jQuery.i18n.prop('facets.max.select1'));
        }
    });

    // reset facet options to default values (clear cookie)
    $("#resetFacetOptions").click(function(e) {
        e.preventDefault();
        $.removeCookie('user_facets');
        document.location.reload(true);
    });

    // load stored prefs from cookie
    var userFacets = $.cookie("user_facets");
    if (userFacets) {
        $(":input.facetOpts").removeAttr("checked");
        var facetList = userFacets.split(",");
        for (i in facetList) {
            if (typeof facetList[i] === "string") {
                var thisFacet = facetList[i];
                //console.log("thisFacet", thisFacet);
                $(":input.facetOpts[value='"+thisFacet+"']").attr("checked","checked");
            }
        }
    } //  note removed else that did page refresh by triggering cookie update code.

    // select all and none buttons
    $(".selectNone").click(function(e) {
        e.preventDefault();
        $(":input.facetOpts").removeAttr("checked");
    });
    $(".selectAll").click(function(e) {
        e.preventDefault();
        $(":input.facetOpts").attr("checked","checked");
    });

    // taxa search - show included synonyms with popup to allow user to refine to a single name
    $("span.lsid").not('.searchError .lsid').each(function(i, el) {
        var lsid = $(this).attr("id");
        var nameString = $(this).html();
        var maxFacets = 20;
        var index = i; // keep a copy
        var queryContextParam = (BC_CONF.queryContext) ? "&qc=" + BC_CONF.queryContext : "";
        var jsonUri = BC_CONF.biocacheServiceUrl + "/occurrences/search.json?q=lsid:" + lsid + "&" + BC_CONF.facetQueries +
            "&facets=raw_taxon_name&pageSize=0&flimit=" + maxFacets + queryContextParam;

        var $clone = $('#resultsReturned #template').clone();
        $clone.attr("id",""); // remove the ID
        $clone.find(".taxaMenuContent").addClass("stopProp");
        // add unique IDs to some elements
        $clone.find("form.raw_taxon_search").attr("id","rawTaxonSearch_" + i);
        $clone.find(":input.rawTaxonSumbit").attr("id","rawTaxonSumbit_" + i);
        $clone.find('.refineTaxaSearch').attr("id", "refineTaxaSearch_" + i);

        $.getJSON(jsonUri, function(data) {
            // use HTML template, see http://stackoverflow.com/a/1091493/249327
            var speciesPageUri = BC_CONF.bieWebappUrl + "/species/" + lsid;
            var speciesPageLink = "<a href='" + speciesPageUri + "' title='Species page' target='BIE'>view species page</a>";
            $clone.find('a.btn').text(nameString).attr("href", speciesPageUri);
            $clone.find('.nameString').text(nameString);
            $clone.find('.speciesPageLink').html(speciesPageLink);

            var synListSize = 0;
            var synList1 = "";
            $.each(data.facetResults, function(k, el) {
                //console.log("el", el);
                if (el.fieldName == "raw_taxon_name") {
                    $.each(el.fieldResult, function(j, el1) {
                        synListSize++;
                        synList1 += "<input type='checkbox' name='raw_taxon_guid' id='rawTaxon_" + index + "_" + j +
                            "' class='rawTaxonCheckBox' value='" + el1.label + "'/>&nbsp;" +
                            "<a href=\"" + BC_CONF.contextPath + "/occurrences/search?q=raw_taxon_name:%22" + encodeURIComponent(el1.label) +
                            "%22\">" + el1.label + "</a> (" + el1.count + ")<br/>";
                    });
                }
            });

            if (synListSize == 0) {
                synList1 += "[no records found]";
            }

            if (synListSize >= maxFacets) {
                synList1 += "<div><br>Only showing the first " + maxFacets + " names<br>See the \"Scientific name (unprocessed)\" section in the \"Refine results\" column on the left for a complete list</div>";
            }

            $clone.find('div.rawTaxaList').html(synList1);
            $clone.removeClass("hide");
            // prevent BS dropdown from closing when clicking on content
            $clone.find('.stopProp').children().not('input.rawTaxonSumbit').click(function(e) {
                e.stopPropagation();
            });

        });

        $(el).html($clone);
    });

    // form validation for raw_taxon_name popup div with checkboxes
    $(":input.rawTaxonSumbit").on("click", function(e) {
        e.preventDefault();
        var submitId = $(this).attr("id");
        var formNum = submitId.replace("rawTaxonSumbit_",""); // 1, 2, etc
        var checkedFound = false;

        $("#refineTaxaSearch_" + formNum).find(":input.rawTaxonCheckBox").each(function(i, el) {
            if ($(el).is(':checked')) {
                checkedFound = true;
                return false; // break loop
            }
        });

        if (checkedFound) {
            //$("form#rawTaxonSearchForm").submit();
            var form  = this.form
            $(form).submit();
        } else {
            alert("Please check at least one \"verbatim scientific name\" checkbox.");
        }
    });

    // load more images button
    $("#loadMoreImages .btn").on("click", function(e) {
        e.preventDefault();
        $(this).addClass('disabled');
        $(this).find('img').show(); // turn on spinner
        var start = $("#imagesGrid").data('count');
        //console.log("start", start);
        loadImages(start);
    });

    // load more species images button
    $("#loadMoreSpecies").on("click", function(e) {
        e.preventDefault();
        var start = $("#speciesGallery").data('count');
        var group = $("#speciesGroup :selected").val();
        var sort = $("#speciesGallery").data('sort');
        //console.log("start", start);
        loadSpeciesInTab(start, sort, group);
    });

    // species tab -> species group drop down
    $("#speciesGroup, #speciesGallerySort").on("change", function(e) {
        var group = $("#speciesGroup :selected").val();
        var sort = $("#speciesGallerySort :selected").val();
        loadSpeciesInTab(0, sort, group);
    });

    // add click even on each record row in results list
    $(".recordRow").click(function(e) {
        e.preventDefault();
        window.location.href = BC_CONF.contextPath + "/occurrences/" + $(this).attr("id");
    }).hover(function(){
            // mouse in
            $(this).css('cursor','pointer');
            $(this).css('background-color','#FFF');
        }, function() {
            // mouse out
            $(this).css('cursor','default');
            $(this).css('background-color','transparent');
    });

    $('.multipleFacetsLink').click(function() {
        var link = this;
        var facetName = link.id.
            replace("multi-", "").
            replace("_guid", "").
            replace("_uid", "_name").
            replace("data_resource_name", "data_resource_uid").
            replace("data_provider_name", "data_provider_uid").
            replace("species_list_name", "species_list_uid").
            //replace(/(_[id])$/, "$1_RNG").
            replace("occurrence_year", "decade");

        var displayName = $(link).data("displayname");
        //console.log(facetName, displayName);
        loadMoreFacets(facetName, displayName, null);
    });

    $('#profiles-selection').click(function(e) {
        e.preventDefault();
        $('#active-profile-name').text(e.target.innerText)
        window.location.href = e.target.href
    })

    // When user clicks the 'view profile description' icon next to profiles selection drop-down
    $('.DQProfileDetailsLink').click(function() {
        $.each($(".cat-table"), function(idx, el) {

            var filterlist = $(el).data('filters');
            var keys = [];

            for (var i = 0; i < filterlist.length; i++) {
                var val = parseFilter(filterlist[i]);
                if (val.length > 0) {
                    keys.push(val[0]);
                }
            }

            // remove duplicate
            keys = removeDuplicates(keys);
            var jsonUri = BC_CONF.biocacheServiceUrl + "/index/fields?fl=" + keys.join(',');
            var map = new Map();
            $.when($.getJSON(jsonUri)).done(function(jarray) {
                for (var i = 0; i < jarray.length; i++) {
                    var obj = jarray[i];
                    if (obj.infoUrl) {
                        map.set(obj.name, obj.infoUrl);
                    }
                }

                var translation = $(el).data('translation');
                var descs = $(el).find('td.filter-description');
                var fqs = $(el).find('td.filter-value');
                var wikis = $(el).find('td.filter-wiki');

                $.each(fqs, function(idx, el) {
                    var fq = $(el).text();
                    var vals = parseFilter(fq);
                    if (vals.length > 0) {
                        var key = vals[0];
                        var val = vals[1];

                        // if there's wiki for the value
                        var wiki = '';
                        if (translation && val in translation && typeof (translation[val]) === 'object') {
                            wiki = "<a href='https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + translation[val].name + "' target='wiki'>Link</a>";
                        }

                        // otherwise if there's wiki for the key
                        if (wiki === '' && map.has(key)) {
                            wiki = replaceURL(map.get(key), 'Link');
                        }

                        $(wikis[idx]).html(wiki);

                        var desc = $(descs[idx]).data('val');
                        $(descs[idx]).html(replaceURL(desc));
                    }
                })
            });
        })
    })

    // when user clicks 'ok' button in the 'data profiles applied' warning dialog
    $('#hide-dq-warning').click(function() {
        $.cookie('dq_warn_off', true, { expires: 365, path: '/' });
    })

    // when use clicks <i/> to view details of a category
    $('.DQCategoryDetailsLink').click(function() {
        var link = this;
        var filters = $(link).data("filters");
        var fq = $(link).data("fq");

        var description = $(link).data("description");
        var dqCategoryLabel = $(link).data('categorylabel')
        var dqtranslation = $(link).data("translation");
        var dqInverse = $(link).data('inverse-filter');

        // show filter name
        $("#fqdetail-heading-name").text($(link).data("dqcategoryname"));
        $("#fqdetail-heading-description").text($(link).data("dqcategorydescription"));
        $('#DQDetailsModal .modal-body #filter-value').html("<b>Filter applied: </b><i>fq=" + fq + "</i>");
        $("#view-excluded").attr('href', dqInverse);

        if (excludeCounts[dqCategoryLabel] !== '0') {
            $("#excluded .exclude-count-label").text(excludeCounts[dqCategoryLabel]).removeData('category').removeAttr('category');
        } else {
            $("#excluded .exclude-count-label").text(excludeCounts[dqCategoryLabel]).data('category', dqCategoryLabel).attr('data-category', dqCategoryLabel);
        }

        var pos = 0;
        var start = 0;
        var keys = [];
        // get all filter keys
        while ((pos = fq.indexOf(':', pos)) != -1) {
            // ':' at pos
            start = fq.lastIndexOf(' ', pos);
            var key = "";
            if (start == -1) {
                key = fq.substring(0, pos);
            } else {
                key = fq.substring(start + 1, pos);
            }

            if (key.length > 0 && key[0] == '-') key = key.substr(1);
            if (key.length > 0 && key[0] == '(') key = key.substr(1);
            keys.push(key);
            pos++;
        }

        // remove duplicate
        keys = removeDuplicates(keys);

        // one AJAX request for each key
        var requests = [];
        keys.forEach(function (key) {
            requests.push(getField(key));
        })

        var numberOfResponse = keys.length;

        var map = new Map();
        var successStatus = "success";

        // when all requests finish (depending on the number of requests, the result
        // structure is different, that's why there's numberOfResponse == 1)
        // map = {fieldKey : [fieldDescription, fieldInfo]}
        // description and info could be null so convert it to "" when it's null
        $.when.apply($, requests).done(function () {
            if (numberOfResponse === 1) {
                if (successStatus === arguments[1] && arguments[0].length > 0) {
                    map.set(arguments[0][0].name, [arguments[0][0].info ? arguments[0][0].info : (arguments[0][0].description ? arguments[0][0].description : ""), arguments[0][0].infoUrl ? arguments[0][0].infoUrl : ""]);
                }
            } else {
                for (var i = 0; i < arguments.length; i++) {
                    if (successStatus === arguments[i][1] && arguments[i][0].length > 0) {
                        map.set(arguments[i][0][0].name, [arguments[i][0][0].info ? arguments[i][0][0].info : (arguments[i][0][0].description ? arguments[i][0][0].description : ""), arguments[i][0][0].infoUrl ? arguments[i][0][0].infoUrl : ""]);
                    }
                }
            }

            // field table
            var html = "";
            $.each(keys, function (index, key) {
                if (map.has(key)) {
                    html += "<tr><td style='word-break: normal'>" + key + "</td><td style='word-break: break-word'>" + replaceURL(map.get(key)[0]) + "</td><td style='word-break: normal'>" + replaceURL(map.get(key)[1], 'Link') + "</td></tr>";
                }
            })

            var valuesHtml = ""

            $.each(filters, function(idx, el) {
                var vals = parseFilter(el);
                if (vals.length > 0) {
                    var key = vals[0];
                    var val = vals[1];

                    var wiki = '';
                    // if value has a wiki link
                    if (dqtranslation && val in dqtranslation && typeof (dqtranslation[val]) === 'object') {
                        wiki = "<a href='https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + dqtranslation[val].name + "' target='_blank'>Link</a>";
                    }

                    // if values has no wiki, show wiki link of key
                    if (wiki === '' && map.has(key)) {
                        wiki = replaceURL(map.get(key)[1], 'Link');
                    }

                    valuesHtml += '<tr>'
                    valuesHtml += '<td class="filter-description" style="word-break: break-word">' + replaceURL(description[idx]) + '</td>'
                    valuesHtml += '<td class="filter-value" style="word-break: normal"><span style="white-space: nowrap;">' + el + '</span></td>'
                    valuesHtml += '<td class="filter-wiki">' + wiki + '</td>'
                    valuesHtml += '</tr>'
                }
            })

            $('.spinnerRow').hide();

            // clear content
            $("table#DQDetailsTable tbody").html("");
            $("table#DQDetailsTable tbody").append(html);

            $("table#DQFiltersTable tbody").html("");
            $("table#DQFiltersTable tbody").append(valuesHtml);

            // if we should disable/hide the expand button
            var category_disabled = $(link).data('disabled');
            var expandButton = $('#expandfilters');
            $(expandButton).prop('disabled', category_disabled);
            if (category_disabled) {
                $(expandButton).hide();
            } else {
                $(expandButton).data('category', $(link).data('categorylabel'));
                $(expandButton).data('filters', $(link).data("fq").split(' AND '));
                $(expandButton).show();
            }
        })
    })

    function parseFilter(filter) {
        var idx = filter.indexOf(":");
        if (idx === -1) return [];

        var val = filter.substring(idx + 1);
        if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1)

        var key = filter.substring(0, idx);

        if (key.startsWith('-')) key = key.substring(1);
        if (key.startsWith('(')) key = key.substring(1);

        return [key, val];
    }

    // to expand a category
    $('#expandfilters').on("click", function(e) {
        var category = $(this).data('category');
        var filters = $(this).data('filters');

        var url = $(location).attr('href');
        // step 1, disable this category
        url = appendURL(url, "disableQualityFilter=" + encodeURIComponent(category).replace(/%20/g, "+").replace(/[()]/g, escape));

        // step 2, append all enabled fqs as user fq
        for (var i = 0; i < filters.length; i++) {
            // console.log('filter = ' + filters[i]);
            url = appendURL(url, 'fq=' + encodeURIComponent(filters[i]).replace(/%20/g, "+").replace(/[()]/g, escape));
        }

        // profile in URL may be invalid, replace it with the actual profile being used
        url = replaceInvalidProfile(url, $.url().param('qualityProfile'), $(this).attr('data-profile'))

        window.location.href = url;
    })

    function replaceInvalidProfile(url, profileInURL, actualProfile) {
        if (profileInURL !== undefined && profileInURL !== actualProfile) {
            url = removeFromURL(url, "qualityProfile=", false);
            url = prependURL(url, "qualityProfile=" + encodeURIComponent(actualProfile).replace(/%20/g, "+").replace(/[()]/g, escape), true);
        }
        return url
    }

    function removeDuplicates(data) {
        var unique = [];
        data.forEach(function(el) {
            if (!unique.includes(el)) {
                unique.push(el);
            }
        })
        return unique;
    }

    function replaceURL(el, text) {
        if (el.indexOf('http') == -1) return el

        var start = el.indexOf('http')
        var end = el.indexOf(' ', start)
        if (end == -1) end = el.length - 1

        var url = el.substr(start, end - start + 1)

        if (typeof text === 'undefined') {
            el = el.replace(url, '<a href="' + url + '" target="_blank">' + url + '</a>')
        } else {
            el = el.replace(url, '<a href="' + url + '" target="_blank">' + text + '</a>')
        }
        return el
    }

    function getField(key) {
        //var jsonUri = "https://biocache-ws.ala.org.au/ws/index/fields?fl=" + key
        var jsonUri = BC_CONF.biocacheServiceUrl + "/index/fields?fl=" + key
        return $.getJSON(jsonUri)
    }

    $('#multipleFacets').on('hidden.bs.modal', function () {
        // clear the tbody content
        $("tbody.scrollContent tr").not("#spinnerRow").remove();
    });

    $("#downloadFacet").on("click", function(e) {
        var facetName = $("table#fullFacets").data("facet");
        //console.log('clicked ' + window.location.href );
        window.location.href = BC_CONF.serverName + "/occurrences/facets/download" + BC_CONF.facetDownloadQuery + '&facets=' + facetName;
    });

    $('#copy-al4r').on('click', function() {
        var input = document.querySelector('#al4rcode');
        navigator.clipboard.writeText(input.value)
            .then(() => {
                $(this).qtip({
                    content: jQuery.i18n.prop('list.copylinks.tooltip.copied'),
                    show: true,
                    hide: { when: { event: 'mouseout'} }
                })})
            .catch((error) => { alert(jQuery.i18n.prop('list.copylinks.alert.failed') + error) })
    });

    $('#copy-al4r').on('mouseleave', function() {
        $(this).qtip({
            content: jQuery.i18n.prop('list.copylinks.tooltip.copytoclipboard'),
            show: { when: { event: 'mouseover'} }
        })
    })

    // when open the user preference dlg
    $('.DQPrefSettingsLink').click(function() {
        var prefSettings = $('#DQPrefSettings');
        var userPref = prefSettings.data('userpref-json');
        var profiles = prefSettings.data('profiles');

        var userProfileEnabled = false;

        // if not disable all
        if (!userPref.disableAll) {
            // if preferred profile set
            var userProfileSet = userPref.dataProfile != null && userPref.dataProfile.length > 0;

            for (var i = 0; i < profiles.length; i++) {
                if (profiles[i] === userPref.dataProfile) {
                    userProfileEnabled = true;
                    break;
                }
            }
        }

        var profileSelect = $('#prefer_profile');

        if (userPref.disableAll) { // if disable all
            profileSelect.val('disableall-option');
        } else if (userProfileEnabled && userPref.dataProfile !== null) { // if a profile selected and enabled
            profileSelect.val(userPref.dataProfile);
        } else { // if no profile selected or selected profile disabled, use system default
            profileSelect.val(prefSettings.data('defaultprofilename'));
        }

        $('#profile_expand').val(userPref.expand ? 'expanded' : 'collapsed');
    })

    // when submit the user preference dlg
    $("#submitPref :input.submit").on("click", function(e) {
        e.preventDefault();
        var prefSettings = $('#DQPrefSettings');
        var userPref = prefSettings.data('userpref-json');

        // check user preferred profile
        var prefProfile = $('#prefer_profile').val();
        if (prefProfile === 'disableall-option') {
            userPref.disableAll = true;
            userPref.dataProfile = null;
        } else {
            userPref.disableAll = false;
            userPref.dataProfile = prefProfile;
        }

        // set expand
        userPref.expand = $('#profile_expand').val() === 'expanded';
        $.cookie.json = true;
        // if user logged in
        if (BC_CONF.userId) {
            // save the dq profile detail expand/collapse state
            $.cookie(BC_CONF.expandKey, {expand: userPref.expand});
            $.ajax({
                url: BC_CONF.serverName + "/user/" + BC_CONF.prefKey,
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(userPref),
                success: applyUserPreference, // reload on success
                error: function() {
                    window.alert(jQuery.i18n.prop('dq.warning.failedtosave'));
                }
            }).always(function() {
                $('#DQPrefSettings').modal('hide');
            })
        } else { // else save in cookie
            $.cookie(BC_CONF.prefKey, userPref, { expires: 365 });
            // save the dq profile detail expand/collapse state
            $.cookie(BC_CONF.expandKey, {expand: userPref.expand});
            $('#DQPrefSettings').modal('hide');
            applyUserPreference(userPref)
        }
    })

    function applyUserPreference(userPref) {
        var prefSettings = $('#DQPrefSettings');

        // enabled filters of current profile, used to remove expanded fqs in url
        var filtersvalue = prefSettings.data('filters');
        var filterSet = new Set();
        for (var i = 0; i < filtersvalue.length; i++) {
            filterSet.add(filtersvalue[i]);
        }

        // get current url
        var url = $(location).attr('href');

        // 1. remove qualityProfile from URL
        url = removeFromURL(url, "qualityProfile=", false);
        // 2. remove disable all from URL
        url = removeFromURL(url, "disableAllQualityFilters=", false);
        // 3. remove disableQualityFilter from URL
        var disabledQualityFilters = $.url().param('disableQualityFilter');
        if (disabledQualityFilters !== undefined) {
            // if only 1 category disabled
            if (typeof disabledQualityFilters === "string") {
                url = removeFromURL(url, "disableQualityFilter=", false);
            } else {
                for (var i = 0; i < disabledQualityFilters.length; i++) {
                    url = removeFromURL(url, "disableQualityFilter=", false);
                }
            }
        }

        // fqs contains current fqs in url, it could be expanded or user specified
        var fqList = $.url().param('fq');
        var fqs = [];
        if (fqList !== undefined) {
            if (typeof fqList === "object") {
                for (var i = 0; i < fqList.length; i++) {
                    fqs.push(fqList[i]);
                }
            } else if (typeof fqList === "string") {
                fqs.push(fqList);
            }
        }

        // 4. remove fqs from URL
        for (var i = 0; i < fqs.length; i++) {
            // remove those belong to this profile so only user specified fqs stay
            if (filterSet.has(fqs[i])) {
                url = removeFromURL(url, 'fq=' + encodeURIComponent(fqs[i]).replace(/%20/g, "+").replace(/[()]/g, escape), true);
            }
        }

        // 5. add qualityProfile=xxx or disableAllQualityFilter=true to URL
        if (userPref.disableAll) {
            url = prependURL(url,"disableAllQualityFilters=true", true);
        } else {
            url = prependURL(url, "qualityProfile=" + encodeURIComponent(userPref.dataProfile).replace(/%20/g, "+").replace(/[()]/g, escape), true);
        }

        window.location.href = url;
    }

    // form validation for form#facetRefineForm
    $("#submitFacets :input.submit").on("click", function(e) {
        e.preventDefault();
        var inverseModifier = ($(this).attr('id') == 'exclude') ? "-" : "";
        var fqArray = [];
        var facetName = $("table#fullFacets").data("facet");
        var checkedFound = false;
        var selectedCount = 0;
        var maxSelected = 15;
        var selectedItemsArray = $("form#facetRefineForm").find(":input.fqs:checked")
        var numberOfSelectedItems = selectedItemsArray.length;

        selectedItemsArray.each(function(i, el) {
            checkedFound = true;
            selectedCount++;

            if (numberOfSelectedItems == 1 && inverseModifier && $(el).val().startsWith("-")) {
                // exclude "no value"/"not specified" facet values
                // is effectively an include all facet values (therefore "no values" are not included)
                fqArray.push( $(el).val().substring(1) ); //removes "-"
                inverseModifier = ""; // remove this as we are doing an inverse of an inverse
            } else if ($(el).val().startsWith("-")) {
                // "no value"/"not specified" facet values are special case
                // see https://stackoverflow.com/a/22616568/249327
                fqArray.push( "(*:* " + $(el).val() + ")" );
            } else {
                fqArray.push($(el).val());
            }
        });

        // join selected fq values together with OR operator
        fq = fqArray.join(" OR ");

        if (fq.indexOf(' OR ') != -1) {
            fq = "(" + fq + ")"; // surround with braces so that exclude (inverse) searches work
        }

        if (checkedFound && selectedCount > maxSelected) {
            alert("Too many options selected - maximum is " + maxSelected + ", you have selected " + selectedCount + ", please de-select " +
                (selectedCount - maxSelected) + " options. \n\nNote: if you want to include/exclude all possible values (wildcard filter), use the drop-down option on the buttons below.");
        } else if (checkedFound) {
            //$("form#facetRefineForm").submit();
            var hash = window.location.hash;
            var fqString = "&fq=" + inverseModifier + fq;
            window.location.href = window.location.pathname + BC_CONF.searchString + fqString + hash;
        } else {
            alert("Please select at least one checkbox.");
        }
    });

    // switch caret style
    $('.dq-filters-collapse').click(function (e) {
        $.cookie.json = true;
        var el = $(this).find('i');
        if ($(el).hasClass('fa-caret-right')) {
            $(el).removeClass('fa-caret-right');
            $(el).addClass('fa-caret-down');
            // save the expand/collapse state to cookie so when page refresh
            // we can restore the state
            $.cookie(BC_CONF.expandKey, {expand: true});
        } else if ($(el).hasClass('fa-caret-down')) {
            $(el).removeClass('fa-caret-down');
            $(el).addClass('fa-caret-right');
            $.cookie(BC_CONF.expandKey, {expand: false});
        }
    });

    // when dlg pops, load and init status, set checkall status
    $('.multipleFiltersLink').click(function() {
        var filterStatus = $("form#filterRefineForm").find(":input.filters");
        $.each(filterStatus, function( i, status ) {
            $(this).prop('checked', $(this).data('enabled'));
        })

        setCheckAllStatus();
        setFiltersInitialStatus();
    });

    // check checkbox for each single filter, then set checkall
    function setCheckAllStatus() {
        var filterStatus = $("form#filterRefineForm").find(":input.filters");
        var allchecked = true;
        var allunchecked = true;
        $.each(filterStatus, function( i, el ) {
            allchecked = allchecked && $(el).prop('checked');
            allunchecked = allunchecked && !($(el).prop('checked'));
        })

        if (allchecked) {
            $("#filterRefineForm .checkall").prop('checked', true);
        } else if (allunchecked) {
            $("#filterRefineForm .checkall").prop('checked', false);
        } else {
            $("#filterRefineForm .checkall").prop('checked', false);
        }
    }

    function setFiltersInitialStatus() {
        var filterStatus = $("form#filterRefineForm").find(":input.filters");
        var filters = $("form#filterRefineForm").find("td.filternames");

        $.each(filterStatus, function( i, el ) {
            var checked = $(el).prop('checked');
            var category = $(el).data('category');
            // 3 states, 'enabled', 'expanded', 'disabled'
            if (checked === true) {
                $("#filterRefineForm").find('.expand[data-category="' + category + '"]').show();
                $("#filterRefineForm").find('.expanded[data-category="' + category + '"]').hide();
                $(filters[i]).attr('data-expanded', false);
            } else {
                // if not checked, check if it's expanded
                $("#filterRefineForm").find('.expand[data-category="' + category + '"]').hide();

                if (ifExpanded($(el).data('category'), $(filters[i]).data("filters"))) {
                    $("#filterRefineForm").find('.expanded[data-category="' + category + '"]').show();
                    $(filters[i]).attr('data-expanded', true);
                } else {
                    $("#filterRefineForm").find('.expanded[data-category="' + category + '"]').hide();
                    $(filters[i]).attr('data-expanded', false);
                }
            }
        })
    }

    function ifExpanded(categoryName, filters) {
        // get all disabled categories from the url
        var disableQualityFilterSet = new Set();
        var disabledFilter = $.url().param('disableQualityFilter');
        if (typeof disabledFilter === "object") {
            disableQualityFilterSet = new Set(disabledFilter);
        } else if (typeof disabledFilter === "string") {
            disableQualityFilterSet.add(disabledFilter);
        }

        // if not disabled it can't be expanded
        if (!disableQualityFilterSet.has(categoryName)) return false;

        var fqSet = new Set();

        var fqs = $.url().param('fq');
        if (typeof fqs === "object") {
            fqSet = new Set(fqs);
        } else if (typeof fqs === "string") {
            fqSet.add(fqs);
        }

        var len = filters.length;
        if ((len > 0) && filters.startsWith('[') && filters.endsWith(']')) {
            filters = filters.substring(1, len - 1);
        }

        filters = filters.split(', ')

        for (var i = 0; i < filters.length; i++) {
            if (!fqSet.has(filters[i])) return false;
        }

        return true;
    }

    // handle enable/disable all
    $("#filterRefineForm .checkall").on("click", function(e) {
        $("form#filterRefineForm").find(":input.filters").prop('checked', $(this).prop('checked'));
        setCheckAllStatus();
        updateFiltersStatus();
    });

    function updateFiltersStatus() {
        var checks = $("form#filterRefineForm").find(":input.filters")

        $.each(checks, function( i, el ) {
            updateIndividualStatus($(el));
        })
    }
    // handle checkbox for each filter
    $("#filterRefineForm :input.filters").on("click", function() {
        setCheckAllStatus();
        updateIndividualStatus($(this));
    })

    function updateIndividualStatus(el) {
        var checked = $(el).prop('checked');
        var category = $(el).data('category');
        if (checked) {
            $("#filterRefineForm").find('.expand[data-category="' + category + '"]').show();
        } else {
            $("#filterRefineForm").find('.expand[data-category="' + category + '"]').hide();
        }
        $("#filterRefineForm").find('.expanded[data-category="' + category + '"]').hide();
    }

    // expand button clicked
    $("#filterRefineForm :button.expand").on("click", function(e) {
        e.preventDefault();
        var category = $(this).data('category');
        // if expand clicked, uncheck enabled
        $("#filterRefineForm").find('.filters[data-category="' + category + '"]').prop('checked', false);
        // hide expand button
        $(this).hide();
        // show 'Expanded' status
        $("#filterRefineForm").find('.expanded[data-category="' + category + '"]').show();
        // unselect all checked
        $("#filterRefineForm .checkall").prop('checked', false);
    })

    $("#submitFilters :input.submit").on("click", function(e) {
        e.preventDefault();

        // get all disabled categories from the url
        // we don't care disableall param
        var disableQualityFilterSet = new Set();
        var disabledFilter = $.url().param('disableQualityFilter');
        if (typeof disabledFilter === "object") {
            disableQualityFilterSet = new Set(disabledFilter);
        } else if (typeof disabledFilter === "string") {
            disableQualityFilterSet.add(disabledFilter);
        }

        // get current url
        var url = $(location).attr('href');

        var filterForm = $("form#filterRefineForm")
        var fitlers = filterForm.find("td.filternames");
        var filterStatus = filterForm.find(":input.filters");
        var expanded = filterForm.find(".expanded");

        // replace url encoded %20 with '+' because groovy encodes space to '+'
        $.each(filterStatus, function( i, status ) {
            var filterlabel = $(fitlers[i]).data('category');
            // get checked status
            var toDisable = !this.checked;

            if (toDisable) { // if to disable, add it to disable list
                if (!disableQualityFilterSet.has(filterlabel)) {
                    url = appendURL(url, "disableQualityFilter=" + encodeURIComponent(filterlabel).replace(/%20/g, "+").replace(/[()]/g, escape));
                }

                var alreadyExpanded = $(fitlers[i]).data('expanded');
                var nowToExpand = !$(expanded[i]).is(":hidden");

                if (nowToExpand && !alreadyExpanded) {
                    url = appendFiltersToUrl(url, $(fitlers[i]).data("filters"));
                } else if (!nowToExpand && alreadyExpanded) {
                    url = removeFiltersFromFq($(fitlers[i]).data("filters"), url);
                }
            } else { // if to enable, remove it from disable list + remove expanded fqs
                if (disableQualityFilterSet.has(filterlabel)) {
                    url = removeFromURL(url, "disableQualityFilter=" + encodeURIComponent(filterlabel).replace(/%20/g, "+").replace(/[()]/g, escape), true);
                }

                url = removeFiltersFromFq($(fitlers[i]).data("filters"), url);
            }
        })

        // profile in URL may be invalid, replace it with the actual profile being used
        url = replaceInvalidProfile(url, $.url().param('qualityProfile'), filterForm.attr('data-profile'))

        window.location.href = url;
    })

    function appendFiltersToUrl(url, filters) {
        var len = filters.length;
        if ((len > 0) && filters.startsWith('[') && filters.endsWith(']')) {
            filters = filters.substring(1, len - 1);
        }

        // split all fqs
        filters.split(', ').forEach(function(filter) {
            var queryToAppend = "fq=" + encodeURIComponent(filter).replace(/%20/g, "+").replace(/[()]/g, escape);
            if (url.indexOf(queryToAppend) === -1) {
                url = appendURL(url, queryToAppend);
            }
        })

        return url;
    }

    function removeFiltersFromFq(filters, url) {
        var len = filters.length;
        if ((len > 0) && filters.startsWith('[') && filters.endsWith(']')) {
            filters = filters.substring(1, len - 1);
        }

        // get all enabled filters in this category
        filters.split(', ').forEach(function(filter) {
            url = removeFromURL(url, 'fq=' + encodeURIComponent(filter).replace(/%20/g, "+").replace(/[()]/g, escape), true);
        })

        return url;
    }

    // insert query string into url, before the # tag
    function appendURL(url, queryParamsToAppend) {
        var idx = url.indexOf("#");
        if (idx === -1) {
            return url.concat((url.indexOf('?') === -1 ? '?' : '&') + queryParamsToAppend);
        } else {
            return url.slice(0, idx) + (url.indexOf('?') === -1 ? '?' : '&') + queryParamsToAppend + url.slice(idx);
        }
    }

    function prependURL(url, queryParamsToAppend, afterSearchKey) {
        var anchorpos = url.indexOf("#");
        var ancchorpart = '';
        if (anchorpos !== -1) {
            ancchorpart = url.substring(anchorpos);
            url = url.substring(0, anchorpos);
        }

        var queryStringpos = url.indexOf('?');
        var queryString = ''
        if (queryStringpos !== -1) {
            queryString = url.substring(queryStringpos + 1);
            url = url.substring(0, queryStringpos);
        }

        // trim query string
        queryString = queryString.trim();
        var queries = []
        if (queryString !== '') {
            queries = queryString.split('&');
        }

        var idx = 0;
        // if insert it after search keys: q=, qid=, lat=, lng=, radius=
        if (afterSearchKey) {
            for (; idx < queries.length; idx++) {
                var query = queries[idx];
                if (!query.startsWith('q=') && !query.startsWith('qid=') && !query.startsWith('lat=') && !query.startsWith('lng=') && !query.startsWith('radius=') && !query.startsWith('taxa=')) {
                    break;
                }
            }
        }

        queries.splice(idx, 0, queryParamsToAppend)
        return url + '?' + queries.join('&') + ancchorpart;
    }

    function removeFromURL(url, sToRemove, exactMatch) {
        var anchorpos = url.indexOf('#');
        var anchorpart = "";
        if (anchorpos !== -1) {
            anchorpart = url.substring(anchorpos);
            url = url.substring(0, anchorpos);
        }

        var serverPath = url;
        var queryString = ""
        var qIndex = url.indexOf('?');
        if (qIndex !== -1) {
            serverPath = url.substring(0, qIndex);
            queryString = url.substring(qIndex + 1);
        }

        var tokens = queryString.split('&');
        var idx = -1;
        // Match the exact value
        if (exactMatch) {
            idx = tokens.indexOf(sToRemove);
        } else {
            for (var i = 0; i < tokens.length; i++) {
                if (tokens[i].startsWith(sToRemove)) {
                    idx = i;
                    break;
                }
            }
        }

        if (idx !== -1) {
            tokens.splice(idx, 1);
        }

        queryString = tokens.join('&')
        return serverPath + (queryString.length > 0 ? '?' : '') + queryString + anchorpart;
    }

    // Drop-down option on facet popup div - for wildcard fq searches
    $('#submitFacets a.wildcard').on('click', function(e) {
        e.preventDefault();
        var link = this;
        var inverseModifier = ($(link).attr('id').indexOf('exclude') != -1) ? "-" : "";
        var facetName = $("table#fullFacets").data("facet");
        var fqString = "&fq=" + inverseModifier + facetName + ":*";
        //console.log("fqString",fqString);
        window.location.href = window.location.pathname + BC_CONF.searchString + fqString
    });

    // QTip generated tooltips
    //if($.fn.qtip.plugins.iOS) { return false; }

    $("a.multipleFacetsLink, a#downloadLink, a#alertsLink, .tooltips, .tooltip, span.dropDown a, div#customiseFacets > a, a.removeLink, .btn, .rawTaxonSumbit").qtip({
        style: {
            classes: 'ui-tooltip-rounded ui-tooltip-shadow'
        },
        position: {
            target: 'mouse',
            adjust: { x: 6, y: 14 }
        }
    });

    // user preference settings and download link tooltips will be above the control
    $("#usersettings, a.copyLink").qtip({
        style: {
            classes: 'ui-tooltip-rounded ui-tooltip-shadow'
        },
        position: {
            target: 'mouse',
            my: 'bottom center',
            adjust: { x: -6, y: -10 }
        }
    });

    // maultiple facets popup - sortable column heading links
    $("a.fsort").on("click", function(e) {
        e.preventDefault();
        var fsort = $(this).data('sort');
        var foffset = $(this).data('foffset');
        var table = $(this).closest('table');
        if (table.length == 0) {
            //console.log("table 1", table);
            table = $(this).parent().siblings('table#fullFacets');
        }
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, true);
    });

    // loadMoreValues (legacy - now handled by inview)
    $("#multipleFacets").on("click", "a.loadMoreValues", function(e) {
        e.preventDefault();
        var link = $(this);
        var fsort = link.data('sort');
        var foffset = link.data('foffset');
        var table = $("table#fullFacets");
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, false);
    });

    // Inview trigger to load more values when tr comes into view
    $("#multipleFacets").on("inview", "tr#loadMore", function() {
        var link = $(this).find("a.loadMoreValues");
        //console.log("inview", link);
        var fsort = link.data('sort');
        var foffset = link.data('foffset');
        var table = $("table#fullFacets");
        //console.log("table 2", table);
        var facetName = $(table).data('facet');
        var displayName = $(table).data('label');
        //loadMultiFacets(facetName, displayName, criteria, foffset);
        loadFacetsContent(facetName, fsort, foffset, BC_CONF.facetLimit, false);
    });

    // Email alert buttons
    var alertsUrlPrefix = BC_CONF.alertsUrl || "https://alerts.ala.org.au";
    $("a#alertNewRecords, a#alertNewAnnotations").click(function(e) {
        e.preventDefault();
        var query = $("<p>"+BC_CONF.queryString+"</p>").text(); // strips <span> from string
        var fqArray = decodeURIComponent(BC_CONF.facetQueries).split('&fq=').filter(function(e){ return e === 0 || e }); // remove empty elements
        if (fqArray) {
            var fqueryString = fqArray.join("; ");
            if(fqueryString.length > 0){
                query += " (" + fqueryString + ")"; // append the fq queries to queryString
            }
        }
        var methodName = $(this).data("method");
        var url = alertsUrlPrefix + "/ws/" + methodName + "?";
        var searchParamsEncoded = encodeURIComponent(decodeURIComponent(BC_CONF.searchString)); // prevent double encoding of chars
        if (query.length >= 250) {
            url += "queryDisplayName="+encodeURIComponent(query.substring(0, 149) + "...");
        } else {
            url += "queryDisplayName="+encodeURIComponent(query);
        }
        url += "&baseUrlForWS=" + encodeURIComponent(BC_CONF.biocacheServiceUrl);
        url += "&baseUrlForUI=" + encodeURIComponent(BC_CONF.serverName);
        url += "&webserviceQuery=%2Foccurrences%2Fsearch" + searchParamsEncoded;
        url += "&uiQuery=%2Foccurrences%2Fsearch" + searchParamsEncoded;
        url += "&resourceName=" + encodeURIComponent(BC_CONF.resourceName);
        //console.log("url", query, methodName, searchParamsEncoded, url);
        window.location.href = url;
    });

    // Show/hide the facet groups
    $('.showHideFacetGroup').click(function(e) {
        e.preventDefault();
        var name = $(this).data('name');
        //console.log('toggle on #group_' + name, $('#group_' + name).is(":visible"))
        $(this).find('span').toggleClass('right-caret');
        $('#group_' + name).slideToggle(600, function() {
            //console.log('showHideFacetGroup',name);
            if ($('#group_' + name).is(":visible") ) {
                $('#group_' + name).find(".nano").nanoScroller({ preventPageScrolling: true });
                amplify.store('search-facets-state-' + name, true);
                //console.log("storing facet state", name, amplify.store('search-facets-state-' + name));
            } else {
                amplify.store('search-facets-state-' + name, null);
                //console.log("un-storing facet state", name, amplify.store('search-facets-state-' + name));
            }
        });
    });

    // Hide any facet groups if they don't contain any facet values
    $('.facetsGroup').each(function(i, el) {
        var name = $(el).attr('id').replace(/^group_/, '');
        var wasShown = amplify.store('search-facets-state-' + name);
        //console.log('facetsGroup','search-facets-state-' + name + '=', wasShown);
        if ($.trim($(el).html()) == '') {
            //console.log("is empty", name);
            $('#heading_' + name).hide();
        } else if (wasShown) {
            //console.log("wasShown", $(el).prev());
            $(el).prev().find('a').click();
        }
    });

    // scroll bars on facet values
    $(".nano").nanoScroller({ preventPageScrolling: true});
    //$(".nano").overlayScrollbars({  });

    // store last search in local storage for a "back button" on record pages
    amplify.store('lastSearch', $.url().attr('relative'));

    // mouse over affect on thumbnail images
    $('#recordImages').on('hover', '.imgCon', function() {
        $(this).find('.brief, .detail').toggleClass('hide');
    });


    var imageId, attribution, recordUrl, scientificName;
    // Lightbox
    $(document).delegate('.thumbImage', 'click', function(event) {
        var recordLink = '<a href="RECORD_URL">View details of this record</a>'
        event.preventDefault();
        imageId = $(this).attr('data-image-id');
        scientificName = $(this).attr('data-scientific-name');
        attribution = $(this).find('.meta.detail').html();
        recordUrl = $(this).attr('href');
        recordLink = recordLink.replace('RECORD_URL', recordUrl);
        var flagIssueLink = '<a href="RECORD_URL">record.</a>';
        flagIssueLink = flagIssueLink.replace('RECORD_URL', recordUrl);
        attribution += '<br>' + recordLink +
                       '<br><br>If this image is incorrectly<br>identified please flag an<br>issue on the ' + flagIssueLink +'<br>';
        setDialogSize();
        $('#imageDialog').modal('show');
    });

    // show image only after modal dialog is shown. otherwise, image position will be off the viewing area.
    $('#imageDialog').on('shown.bs.modal',function () {

        if($("#viewerContainerId").width() == 0){
            //this is a workaround for #viewContainerId having width of zero, which results in the
            //image not rendering
            $("#viewerContainerId").width(($('#imageDialog').width() - 50));
        }

        imgvwr.viewImage($("#viewerContainerId"), imageId, scientificName, undefined, {
            imageServiceBaseUrl: BC_CONF.imageServiceBaseUrl,
            addSubImageToggle: false,
            addCalibration: false,
            addDrawer: false,
            addCloseButton: true,
            addAttribution: true,
            addLikeDislikeButton: BC_CONF.addLikeDislikeButton,
            addPreferenceButton: BC_CONF.addPreferenceButton,
            attribution: attribution,
            disableLikeDislikeButton: BC_CONF.disableLikeDislikeButton,
            likeUrl: BC_CONF.likeUrl + '?id=' + imageId,
            dislikeUrl: BC_CONF.dislikeUrl + '?id=' + imageId,
            userRatingUrl: BC_CONF.userRatingUrl + '?id=' + imageId,
            userRatingHelpText: BC_CONF.userRatingHelpText.replace('RECORD_URL', recordUrl),
            savePreferredSpeciesListUrl: BC_CONF.savePreferredSpeciesListUrl + '?id=' + imageId + '&scientificName=' + scientificName,
            getPreferredSpeciesListUrl: BC_CONF.getPreferredSpeciesListUrl
        });
    });

    // set size of modal dialog during a resize
    $(window).on('resize', setDialogSize)
    function setDialogSize() {
        var height = $(window).height()
        height *= 0.8
        $("#viewerContainerId").height(height);
    }

    $('#modal-dismiss-dq').modal()

    // expand / collapse data profile details
    var dqFilterCollapse = $('#dq-filters-collapse')
    dqFilterCollapse.collapse({
        toggle: BC_CONF.expandProfileDetails
    })

    switchCaretStyle($('.dq-filters-collapse'));

    function switchCaretStyle(elem) {
        var el = elem.find('i');
        if (elem.hasClass('collapsed')) {
            $(el).removeClass('fa-caret-down');
            $(el).addClass('fa-caret-right');
        } else {
            $(el).removeClass('fa-caret-right');
            $(el).addClass('fa-caret-down');
        }
    }
}); // end JQuery document ready

/**
 * Catch sort drop-down and build GET URL manually
 */
function reloadWithParam(paramName, paramValue) {
    var paramList = [];
    var q = $.url().param('q'); //$.query.get('q')[0];
    var fqList = $.url().param('fq'); //$.query.get('fq');
    var sort = $.url().param('sort');
    var dir = $.url().param('dir') || $.url().param('order'); // solr || grails (via pagination taglib)
    var wkt = $.url().param('wkt');
    var pageSize = $.url().param('pageSize');
    var lat = $.url().param('lat');
    var lon = $.url().param('lon');
    var rad = $.url().param('radius');
    var taxa = $.url().param('taxa');
    var qualityProfile = $.url().param('qualityProfile');
    var disableQualityFilter = $.url().param('disableQualityFilter');
    var disableAllQualityFilters = $.url().param('disableAllQualityFilters');

    // add query param
    if (q != null) {
        paramList.push("q=" + q);
    }
    // add filter query param
    if (fqList && typeof fqList === "string") {
        fqList = [ fqList ];
    } else if (!fqList) {
        fqList = [];
    }

    if (fqList) {
        paramList.push("fq=" + fqList.join("&fq="));
    }

    // add sort/dir/pageSize params if already set (different to default)
    if (paramName != 'sort' && sort) {
        paramList.push('sort' + "=" + sort);
    }

    if (paramName != 'dir' && dir) {
        console.log('dir',dir);
        paramList.push('dir' + "=" + dir);
    }

    if (paramName != 'pageSize' && pageSize) {
        paramList.push("pageSize=" + pageSize);
    }

    if (paramName != null && paramValue) {
        paramList.push(paramName + "=" + paramValue);
    }
    
    if (lat && lon && rad) {
        paramList.push("lat=" + lat);
        paramList.push("lon=" + lon);
        paramList.push("radius=" + rad);
    }
    
    if (taxa) {
        paramList.push("taxa=" + taxa);
    }

    if (wkt){
        paramList.push("wkt=" + wkt);
    }

    if (qualityProfile) {
        paramList.push('qualityProfile=' + qualityProfile)
    }

    if (disableQualityFilter) {
        if (typeof disableQualityFilter === "string") {
            disableQualityFilter = [ disableQualityFilter ]
        }
        disableQualityFilter.forEach(function(value, index, array) {
            paramList.push('disableQualityFilter=' + value);
        })
    }

    if (disableAllQualityFilters) {
        paramList.push('disableAllQualityFilters=' + disableAllQualityFilters);
    }

    //alert("params = "+paramList.join("&"));
    //alert("url = "+window.location.pathname);
    window.location.href = window.location.pathname + '?' + paramList.join('&');
}

/**
 * Load the default charts
 */
function loadDefaultCharts() {
    if (dynamicFacets && dynamicFacets.length > 0) {
        var chartsConfigUri = BC_CONF.biocacheServiceUrl + "/upload/charts/" + BC_CONF.selectedDataResource + ".json";
        $.getJSON(chartsConfigUri, function (chartsConfig) {

            //console.log("Number of dynamic charts to render: " + chartsConfig.length, dynamicFacets);

            var conf = {}

            $.each(chartsConfig, function (index, config) {
                if (config.visible) {
                    var type = 'bar'
                    if (config.format == 'pie') type = 'doughnut'
                    conf[config.field] = {
                        chartType: type,
                        emptyValueMsg: '',
                        hideEmptyValues: true,
                        title: config.field
                    }
                }
            });
            chartConfig.charts = conf;

            var charts = ALA.BiocacheCharts('charts', chartConfig);
        });
    } else {
        var charts = ALA.BiocacheCharts('charts', chartConfig);
    }
}

/**
 * Load the user charts
 */
function loadUserCharts() {

    if (userChartConfig) { //userCharts
        //load user charts
        $.ajax({
            dataType: "json",
            url: BC_CONF.serverName + "/user/chart",
            success: function(data) {
                if ($.map(data, function (n, i) {
                        return i;
                    }).length > 3) {
                    //console.log("loading user chart data")
                    //console.log(data)

                    //do not display user charts by default
                    $.map(data.charts, function (value, key) {
                        value.hideOnce = true;
                    });

                    data.chartControlsCallback = saveChartConfig

                    //set current context
                    data.biocacheServiceUrl = userChartConfig.biocacheServiceUrl;
                    data.biocacheWebappUrl = userChartConfig.biocacheWebappUrl;
                    data.query = userChartConfig.query;
                    data.queryContext = userChartConfig.queryContext;
                    data.filter = userChartConfig.filter;
                    data.facetQueries = userChartConfig.facetQueries;

                    var charts = ALA.BiocacheCharts('userCharts', data);
                } else {
                    userChartConfig.charts = {}
                    userChartConfig.chartControlsCallback = saveChartConfig
                    var charts = ALA.BiocacheCharts('userCharts', userChartConfig);
                }
            },
            error: function (data) {
                userChartConfig.charts = {}
                userChartConfig.chartControlsCallback = saveChartConfig
                var charts = ALA.BiocacheCharts('userCharts', userChartConfig);
            }
        })
    }
}

function saveChartConfig(data) {
    //console.log("saving user chart data");
    //console.log(data);

    var d = jQuery.extend(true, {}, data);

    //remove unnecessary data
    delete d.chartControlsCallback
    $.each (d.charts, function(key, value) { if (value.slider) delete value.slider; });
    $.each (d.charts, function(key, value) { if (value.datastructure) delete value.datastructure});
    $.each (d.charts, function(key, value) { if (value.chart) delete value.chart});

    if (data) {
        $.ajax({
            url: BC_CONF.serverName + "/user/chart",
            type: "POST",
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(d)
        })
    }
}

/**
 * Load images in images tab
 */
function loadImagesInTab() {
    loadImages(0);
}

function loadImages(start) {

        start = (start) ? start : 0;
        var imagesJsonUri = BC_CONF.biocacheServiceUrl + "/occurrences/search.json" + BC_CONF.searchString +
            "&fq=multimedia:Image&facet=false&pageSize=20&start=" + start + "&sort=identification_qualifier_s&dir=asc";
        $.getJSON(imagesJsonUri, function (data) {
            //console.log("data",data);
            if (data.occurrences && data.occurrences.length > 0) {
                //var htmlUl = "";
                if (start == 0) {
                    $("#imagesGrid").html("");
                }
                var count = 0;
                $.each(data.occurrences, function (i, el) {
                    //console.log("el", el.image);
                    count++;
                    var sciNameRawOrMatched = (el.raw_scientificName === undefined? el.scientificName : el.raw_scientificName); //e.g. if data submitted using species ID's instead of scientific names
                    // clone template div & populate with metadata
                    var $ImgConTmpl = $('.imgConTmpl').clone();
                    $ImgConTmpl.removeClass('imgConTmpl').removeClass('hide');
                    var link = $ImgConTmpl.find('a.cbLink');
                    //link.attr('id','thumb_' + category + i);
                    link.addClass('thumbImage tooltips');
                    link.attr('href', BC_CONF.contextPath + "/occurrences/" + el.uuid);
                    link.attr('title', 'click to enlarge');
                    link.attr('data-occurrenceuid', el.uuid);
                    link.attr('data-image-id', el.image);
                    link.attr('data-scientific-name', sciNameRawOrMatched);
                    
                    $ImgConTmpl.find('img').attr('src', el.smallImageUrl);
                    // brief metadata
                    var briefHtml = sciNameRawOrMatched;
                    var br = "<br>";
                    if (el.typeStatus) briefHtml += br + el.typeStatus;
                    if (el.institutionName) briefHtml += ((el.typeStatus) ? ' | ' : br) + el.institutionName;
                    $ImgConTmpl.find('.brief').html(briefHtml);
                    // detail metadata
                    var detailHtml = sciNameRawOrMatched;
                    if (el.typeStatus) detailHtml += br + 'Type: ' + el.typeStatus;
                    if (el.collector) detailHtml += br + 'By: ' + el.collector;
                    if (el.eventDate) detailHtml += br + 'Date: ' + moment(el.eventDate).format('YYYY-MM-DD');
                    if (el.institutionName) {
                        detailHtml += br + el.institutionName;
                    } else {
                        detailHtml += br + el.dataResourceName;
                    }
                    $ImgConTmpl.find('.detail').html(detailHtml);
    
                    // write to DOM
                    $("#imagesGrid").append($ImgConTmpl.html());
                });
    
                if (count + start < data.totalRecords) {
                    //console.log("load more", count, start, count + start, data.totalRecords);
                    $('#imagesGrid').data('count', count + start);
                    $("#loadMoreImages").show();
                    $("#loadMoreImages .btn").removeClass('disabled');
                } else {
                    $("#loadMoreImages").hide();
                }
    
            } else {
                $('#imagesGrid').html('<p>' + jQuery.i18n.prop('list.noimages.available') + '</p>');
            }
        }).always(function () {
            $("#loadMoreImages img").hide();
        });
}

/**
 * Load the species tab with list of species from the current query.
 * Uses automatic scrolling to load new bunch of rows when user scrolls.
 *
 * @param start
 */
function loadSpeciesInTab(start, sortField, group) {
    var pageSize = 20;
    var init = $('#speciesGallery').data('init');
    start = (start) ? start : 0;
    group = (group) ? group : "ALL_SPECIES";
    // sortField should be one of: taxa, common, count
    var sortExtras;
    switch (sortField) {
        case 'taxa': sortExtras = "&common=false&sort=index";
            break;
        default:
        case 'common': sortExtras = "&common=true&sort=index";
            break;
        case 'count': sortExtras = "&common=false&sort=count";
            break;
    }

    if (!init) {
        // populate the groups dropdown
        var groupsUrl = BC_CONF.biocacheServiceUrl + "/explore/groups.json" + BC_CONF.searchString + "&facets=species_group";
        $.getJSON(groupsUrl, function(data) {
            if (data.length > 0) {
                $("#speciesGroup").empty();
                $.each(data, function(i, el) {
                    if (el.count > 0) {
                        var indent = Array(el.level + 1).join("-") + " ";
                        var dispayName = el.name.replace("_", " ");
                        if (el.level == 0) {
                            dispayName = dispayName.toLowerCase(); // lowercase
                            dispayName = dispayName.charAt(0).toUpperCase() + dispayName.slice(1); // capitalise first letter
                        }
                        var opt = $("<option value='" + el.name + "'>" + indent + dispayName + " (" + el.speciesCount + ")</option>");
                        $("#speciesGroup").append(opt);
                    }
                });
            }
        }).error(function(){ $("#speciesGroup option").val("Error: species groups were not loaded");});
        //
        $('#speciesGallery').data('init', true);
    } else {
        //$("#loadMoreSpecies").hide();
    }

    if (start == 0) {
        $("#speciesGallery").empty().before("<div id='loadingSpecies'>Loading... <img src='" + BC_CONF.contextPath + "/images/spinner.gif'/></div>");
        $("#loadMoreSpecies").hide();
    } else {
        $("#loadMoreSpecies img").show();
    }

    var speciesJsonUrl = BC_CONF.contextPath + "/proxy/exploreGroupWithGallery" + BC_CONF.searchString + // TODO fix proxy
            "&group=" + group + "&pageSize=" + pageSize + "&start=" + start + sortExtras;

    $.getJSON(speciesJsonUrl, function(data) {
        //console.log("data", data);
        if (data.length > 0) {
            //var html = "<table><thead><tr><th>Image</th><th>Scientific name</th><th>Common name</th><th>Record count</th></tr></thead><tbody>";
            var count = 0;
            $.each(data, function(i, el) {
                // don't show higher taxa
                count++;
                if (el.rankId > 6000 && el.thumbnailUrl) {
                    var imgEl = $("<img src='" + el.thumbnailUrl +
                        "' style='height:100px; cursor:pointer;'/>");
                    var metaData = {
                        type: 'species',
                        guid: el.guid,
                        rank: el.rank,
                        rankId: el.rankId,
                        sciName: el.scientificName,
                        commonName: el.commonName,
                        count: el.count
                    };
                    imgEl.data(metaData);
                    $("#speciesGallery").append(imgEl);
                }
            });

            if (count == pageSize) {
                //console.log("load more", count, start, count + start, data.totalRecords);
                $('#speciesGallery').data('count', count + start);
                $("#loadMoreSpecies").show();
            } else {
                $("#loadMoreSpecies").hide();
            }

            $('#speciesGallery img').ibox(); // enable hover effect

            //html += "</tbody></table>";
//            $("#speciesGallery").append(html);

        }
    }).error(function (request, status, error) {
            alert(request.responseText);
    }).complete(function() {
            $("#loadingSpecies").remove();
            $("#loadMoreSpecies img").hide();
    });
}

/**
 * iBox Jquery plugin for Google Images hover effect.
 * Origina by roxon http://stackoverflow.com/users/383904/roxon
 * Posted to stack overflow: 
 *   http://stackoverflow.com/questions/7411393/pop-images-like-google-images/7412302#7412302
 */
(function($) {
    $.fn.ibox = function() {
        // set zoom ratio //
        resize = 50; // pixels to add to img height
        ////////////////////
        var img = this;
        img.parent().parent().parent().append('<div id="ibox" />');
        $('body').append('<div id="ibox" />');
        var ibox = $('#ibox');
        var elX = 0;
        var elY = 0;

        img.each(function() {
            var el = $(this);

            el.mouseenter(function() {
                ibox.html('');
                var elH = el.height();
                var elW = el.width();
                var ratio = elW / elH; //(elW > elH) ? elW / elH : elH / elW;
                var newH = elH + resize;
                var newW = newH * ratio;
                var offset = (((newW - elW) / 2) + 6);
                //console.log(ratio, elW, newW, offset);
                elX = el.position().left - offset ; // 6 = CSS#ibox padding+border
                elY = el.position().top - 6;
                var h = el.height();
                var w = el.width();
                var wh;
                checkwh = (h < w) ? (wh = (w / h * resize) / 2) : (wh = (w * resize / h) / 2);

                $(this).clone().prependTo(ibox);

                var link, rank, linkTitle, count;
                var md = $(el).data();

                if (md.type == 'species') {
                    link = BC_CONF.bieWebappUrl + "/species/"  + md.guid;
                    linkTitle = "Go to ALA species page";
                    rank = " ";
                    count = " <br/>Record count: " + md.count;
                } else {
                    link = BC_CONF.contextPath + "/occurrences/"  + md.uuid;
                    linkTitle = "Go to occurrence record";
                    rank = "<span style='text-transform: capitalize'>" + md.rank + "</span>: ";
                    count = "";
                }

                var itals = (md.rankId >= 6000) ? "<span style='font-style: italic;'>" : "<span>";
                var infoDiv = "<div style=''><a href='" + link + "' title='" + linkTitle + "'>" + rank + itals +
                    md.sciName + "</span><br/>" + md.commonName.replace("| ", "") + "</a> " + count + "</div>";
                $(ibox).append(infoDiv);
                $(ibox).click(function(e) {
                    e.preventDefault();
                    window.location.href = link;
                });
                
                ibox.css({
                    top: elY + 'px',
                    left: elX + 'px',
                    "max-width": $(el).width() + (2 * wh) + 12
                });

                ibox.stop().fadeTo(200, 1, function() {
                    //$(this).animate({top: '-='+(resize/2), left:'-='+wh},200).children('img').animate({height:'+='+resize},200);
                    $(this).children('img').animate({height:'+='+resize},200);
                });
                
            });

            ibox.mouseleave(function() {
                ibox.html('').hide();
            });
        });
    };
})(jQuery);

// vars for hiding drop-dpwn divs on click outside tem
var hoverDropDownDiv = false;

/**
 * draws the div for selecting multiple facets (popup div)
 *
 * Uses HTML template, found in the table itself.
 * See: http://stackoverflow.com/a/1091493/249327
 */
function loadMoreFacets(facetName, displayName, fsort, foffset) {
    foffset = (foffset) ? foffset : "0";
    var facetLimit = BC_CONF.facetLimit;
    var params = BC_CONF.searchString.replace(/^\?/, "").split("&");
    // include hidden inputs for current request params
    var inputsHtml = "";
    $.each(params, function(i, el) {
        var pair = el.split("=");
        if (pair.length == 2) {
            inputsHtml += "<input type='hidden' name='" + pair[0] + "' value='" + pair[1] + "'/>";
        }
    });
    $('#facetRefineForm').append(inputsHtml);
    $('table#fullFacets').data('facet', facetName); // data attribute for storing facet field
    $('table#fullFacets').data('label', displayName); // data attribute for storing facet display name
    $('#indexCol a').html(displayName); // table heading
    $('#indexCol a').attr('title', 'sort by ' + displayName); // table heading

    $("table#fullFacets tbody").html(""); //clear the existing table

    $("a.fsort").qtip({
        style: {
            classes: 'ui-tooltip-rounded ui-tooltip-shadow'
        },
        position: {
            target: 'mouse',
            adjust: {
                x: 8, y: 12
            }
        }
    });
    // perform ajax
    loadFacetsContent(facetName, fsort, foffset, facetLimit);

}

function loadFacetsContent(facetName, fsort, foffset, facetLimit, replaceFacets) {
    var jsonUri = BC_CONF.serverName + "/occurrences/facets" + BC_CONF.searchString +
        "&facets=" + facetName + "&flimit=" + facetLimit + "&foffset=" + foffset + "&pageSize=0"; // + "&fsort=" + fsort

    if (fsort) {
        // so default facet sorting is used in initial loading
        jsonUri += "&fsort=" + fsort;
    }
    //jsonUri += "&callback=?"; // JSONP trigger

    $.getJSON(jsonUri, function(data) {
        //console.log("data",data);
        if (data.totalRecords && data.totalRecords > 0) {
            var hasMoreFacets = false;
            var html = "";
            $("tr#loadingRow").remove(); // remove the loading message
            $("tr#loadMore").remove(); // remove the load more records link
            if (replaceFacets) {
                // remove any facet values in table
                $("table#fullFacets tr").not("tr.tableHead").not("#spinnerRow").remove();
            }
            $.each(data.facetResults[0].fieldResult, function(i, el) {
                console.log("0. facet", el);
                if (el.count > 0 && i != facetLimit - 1) {

                    // surround with quotes: fq value if contains spaces but not for range queries
                    var fqEsc = ((el.label.indexOf(" ") != -1 || el.label.indexOf(",") != -1 || el.label.indexOf("lsid") != -1) && el.label.indexOf("[") != 0)
                        ? "\"" + el.label + "\""
                        : el.label; // .replace(/:/g,"\\:")
                    var label = (el.displayLabel) ? el.displayLabel : el.label ;
                    var encodeFq = true;
                    if (label.indexOf("@") != -1) {
                        label = label.substring(0,label.indexOf("@"));
                    } else if (jQuery.i18n.prop(el.i18nCode).indexOf("[") == -1) {
                        // i18n substitution
                        label = jQuery.i18n.prop(el.i18nCode);
                    } else if (facetName.indexOf("outlier_layer") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("layer." + label);
                    } else if (facetName.indexOf("user_assertions") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("user_assertions." + label);
                    } else if (facetName.indexOf("duplicate_type") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop("duplication." + label);
                    } else if (facetName.indexOf("taxonomic_issue") != -1 || /^el\d+/.test(label)) {
                        label = jQuery.i18n.prop(label);
                    } else if (!label && el.i18nCode.indexOf("novalue") != -1) {
                        label = "[no value]";
                    } else {
                        var code = facetName + "." + label;
                        var i18nLabel = jQuery.i18n.prop(code);
                        //console.log("ELSE",label, code, i18nLabel, jQuery.i18n.prop(label))
                        var newLabel = (i18nLabel.indexOf("[") == -1) ? i18nLabel : (jQuery.i18n.prop(label));
                        label = (newLabel.indexOf("[") == -1) ? newLabel : label;
                    }
                    facetName = facetName.replace(/_RNG$/,""); // remove range version if present
                    //console.log("label", label, facetName, el);
                    var fqParam = (el.fq) ? encodeURIComponent(el.fq) : facetName + ":" + ((encodeFq) ? encodeURIComponent(fqEsc) : fqEsc) ;
                    //var link = BC_CONF.searchString.replace("'", "&apos;") + "&fq=" + fqParam;

                    //NC: 2013-01-16 I changed the link so that the search string is uri encoded so that " characters do not cause issues 
                    //Problematic URL http://biocache.ala.org.au/occurrences/search?q=lsid:urn:lsid:biodiversity.org.au:afd.taxon:b76f8dcf-fabd-4e48-939c-fd3cafc1887a&fq=geospatial_kosher:true&fq=state:%22Australian%20Capital%20Territory%22
                    var link = BC_CONF.searchString + "&fq=" + fqParam;
                    //console.log(link)
                    var rowType = (i % 2 == 0) ? "normalRow" : "alternateRow";
                    html += "<tr class='" + rowType + "'><td>" +
                        "<input type='checkbox' name='fqs' class='fqs' value=\""  + fqParam +
                        "\"/></td><td class='multiple-facet-value'><a href=\"" + link + "\"> " + label + "</a></td><td class='multiple-facet-count'>" + el.count.toLocaleString() + "</td></tr>";
                }
                if (i == facetLimit - 1) {
                    //console.log("got to end of page of facets: " + i);
                    hasMoreFacets = true;
                }
            });
            $("table#fullFacets tbody").append(html);
            $('#spinnerRow').hide();
            // Fix some border issues
            $("table#fullFacets tr:last td").css("border-bottom", "1px solid #CCCCCC");
            $("table#fullFacets td:last-child, table#fullFacets th:last-child").css("border-right", "none");
            //$("tr.hidden").fadeIn('slow');

            if (hasMoreFacets) {
                var offsetInt = Number(foffset);
                var flimitInt = Number(facetLimit);
                var loadMore =  "<tr id='loadMore' class=''><td colspan='3'><a href='#index' class='loadMoreValues' data-sort='" +
                    fsort + "' data-foffset='" + (offsetInt + flimitInt) +
                    "'>Loading " + facetLimit + " more values...</a></td></tr>";
                $("table#fullFacets tbody").append(loadMore);
                //$("tr#loadMore").fadeIn('slow');
            }

            var tableHeight = $("#fullFacets tbody").height();
            var tbodyHeight = 0;
            $("#fullFacets tbody tr").each(function(i, el) {
                tbodyHeight += $(el).height();
            });
            //console.log("table heights", tableHeight, tbodyHeight);
            if (false && tbodyHeight < tableHeight) {
                // no scroll bar so adjust column widths
                var thWidth = $(".scrollContent td + td + td").width() + 18; //$("th#indexCol").width() + 36;
                $(".scrollContent td + td + td").width(thWidth);

            }
            //$.fancybox.resize();
        } else {
            $("tr#loadingRow").remove(); // remove the loading message
            $("tr#loadMore").remove(); // remove the load more records link
            $('#spinnerRow').hide();
            $("table#fullFacets tbody").append("<tr><td></td><td>[Error: no values returned]</td></tr>");
        }
    });
}
