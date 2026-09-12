(function (sj) {
    "use strict";

    sj.addEvent = function(el, type, handler) {
      if (el.attachEvent) el.attachEvent('on'+type, handler); else el.addEventListener(type, handler);
    }
    sj.onReady = function(ready) {
      if (document.readyState!='loading') ready();
      else if (document.addEventListener) document.addEventListener('DOMContentLoaded', ready);
      else document.attachEvent('onreadystatechange', function(){
          if (document.readyState=='complete') ready();
      });
    }

    async function getSearchData(dataUrl) {
        let response = await fetch(dataUrl);
        return response.text();
    }

    function searchInit() {
        var dataUrl = "/SearchData.json";

        getSearchData(dataUrl)
            .then(function(responseText) {
            var docs = JSON.parse(responseText);

            lunr.tokenizer.separator = /[\s/]+/;

            var index = lunr(function(){
                this.ref('id');
                this.field('title', {boost: 500});
                this.field('content', {boost: 1});
                this.field('url');
                this.metadataWhitelist = ['position']

                for (var i in docs) {
                    this.add({
                        id: i,
                        title: docs[i].title,
                        content: docs[i].content,
                        url: docs[i].url
                    });
                }
            });
            searchLoaded(index, docs);
        }).catch(function(err) {
            console.warn("Error processing the search-data for lunrjs", err);
        });
    }

    function searchLoaded(index, docs) {
        var searchInput = document.getElementById('search-input');
        var searchResults = document.getElementById('search-results');
        var searchCount = document.getElementById('search-count');
        var searchTrigger = document.getElementById('search-trigger');
        var searchModal = document.getElementById('search-modal');
        var searchBackdrop = document.getElementById('search-modal-backdrop');
        var isModal = !!searchModal;
        var currentInput;
        var currentSearchIndex = 0;

        function openModal() {
            if (!isModal) return;
            searchModal.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('search-modal-open');
            document.body.classList.add('search-modal-open');
            searchInput.focus();
        }

        function closeModal() {
            if (!isModal) return;
            searchModal.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('search-modal-open', 'search-active');
            document.body.classList.remove('search-modal-open');
            searchInput.value = '';
            currentInput = '';
            searchResults.innerHTML = '';
            if (searchCount) searchCount.textContent = '';
            searchInput.blur();
        }

        function showSearch() {
            document.documentElement.classList.add('search-active');
        }

        function hideSearch() {
            document.documentElement.classList.remove('search-active');
        }

        function updateCount(count) {
            if (!searchCount) return;
            if (count === 0) {
                searchCount.textContent = '';
            } else {
                searchCount.textContent = count + (count === 1 ? ' result' : ' results');
            }
        }

        function update() {
            currentSearchIndex++;

            var input = searchInput.value;
            if (input === '') {
                hideSearch();
                searchResults.innerHTML = '';
                updateCount(0);
                currentInput = '';
                return;
            }

            showSearch();

            if (input === currentInput) {
                return;
            }

            currentInput = input;
            searchResults.innerHTML = '';

            var results = index.query(function (query) {
                var tokens = lunr.tokenizer(input);
                query.term(tokens, { boost: 10 });
                query.term(tokens, { wildcard: lunr.Query.wildcard.TRAILING });
            });

            if ((results.length === 0) && (input.length > 2)) {
                var tokens = lunr.tokenizer(input).filter(function(token) {
                   return token.str.length < 20;
                });

                if (tokens.length > 0) {
                    results = index.query(function (query) {
                        query.term(tokens, {
                            editDistance: Math.round(Math.sqrt(input.length / 2 - 1))
                        });
                    });
                }
            }

            updateCount(results.length);

            if (results.length === 0) {
                var noResultsDiv = document.createElement('div');
                noResultsDiv.classList.add('search-no-result');
                noResultsDiv.innerText = 'No results found';
                searchResults.appendChild(noResultsDiv);
            } else {
                var resultsList = document.createElement('ul');
                resultsList.classList.add('search-results-list');
                searchResults.appendChild(resultsList);
                addResults(resultsList, results, 0, 10, 100, currentSearchIndex);
            }

            function addResults(resultsList, results, start, batchSize, batchMillis, searchIndex) {
                if (searchIndex != currentSearchIndex) {
                    return;
                }
                for (var i = start; i < (start + batchSize); i++) {
                    if (i == results.length) {
                        return;
                    }
                    addResult(resultsList, results[i]);
                }
                setTimeout(function() {
                    addResults(resultsList, results, start + batchSize, batchSize, batchMillis, searchIndex);
                }, batchMillis);
            }

            function addResult(resultsList, result) {
                var doc = docs[result.ref];
                var resultsListItem = document.createElement('li');
                resultsListItem.classList.add('search-results-list-item');
                resultsList.appendChild(resultsListItem);

                var resultLink = document.createElement('a');
                resultLink.classList.add('search-result');
                resultLink.setAttribute('href', doc.url);
                resultsListItem.appendChild(resultLink);

                var resultTitle = document.createElement('div');
                resultTitle.classList.add('search-result-title');
                resultLink.appendChild(resultTitle);

                var resultDocTitle = document.createElement('div');
                resultDocTitle.classList.add('search-result-doc-title');
                resultDocTitle.innerHTML = doc.doc;
                resultTitle.appendChild(resultDocTitle);
                var resultDocOrSection = resultDocTitle;

                if (doc.doc != doc.title) {
                    var resultSection = document.createElement('div');
                    resultSection.classList.add('search-result-section');
                    resultSection.innerHTML = doc.title;
                    resultTitle.appendChild(resultSection);
                    resultDocOrSection = resultSection;
                }

                var metadata = result.matchData.metadata;
                var titlePositions = [];
                var contentPositions = [];
                for (var j in metadata) {
                    var meta = metadata[j];
                    if (meta.title) {
                        var positions = meta.title.position;
                        for (var k in positions) {
                            titlePositions.push(positions[k]);
                        }
                    }

                    if (meta.content) {
                        var positions = meta.content.position;
                        for (var k in positions) {
                            var position = positions[k];
                            var previewStart = position[0];
                            var previewEnd = position[0] + position[1];
                            var ellipsesBefore = true;
                            var ellipsesAfter = true;
                            for (var n = 0; n < 3; n++) {
                                var nextSpace = doc.content.lastIndexOf(' ', previewStart - 2);
                                var nextDot = doc.content.lastIndexOf('. ', previewStart - 2);
                                if ((nextDot >= 0) && (nextDot > nextSpace)) {
                                    previewStart = nextDot + 1;
                                    ellipsesBefore = false;
                                    break;
                                }
                                if (nextSpace < 0) {
                                    previewStart = 0;
                                    ellipsesBefore = false;
                                    break;
                                }
                                previewStart = nextSpace + 1;
                            }

                            for (var m = 0; m < 3; m++) {
                                var nextSpace = doc.content.indexOf(' ', previewEnd + 1);
                                var nextDot = doc.content.indexOf('. ', previewEnd + 1);
                                if ((nextDot >= 0) && (nextDot < nextSpace)) {
                                    previewEnd = nextDot;
                                    ellipsesAfter = false;
                                    break;
                                }
                                if (nextSpace < 0) {
                                    previewEnd = doc.content.length;
                                    ellipsesAfter = false;
                                    break;
                                }
                                previewEnd = nextSpace;
                            }

                            contentPositions.push({
                                highlight: position,
                                previewStart: previewStart,
                                previewEnd: previewEnd,
                                ellipsesBefore: ellipsesBefore,
                                ellipsesAfter: ellipsesAfter
                            });
                        }
                    }
                }

                if (titlePositions.length > 0) {
                    titlePositions.sort(function(p1, p2){ return p1[0] - p2[0]; });
                    resultDocOrSection.innerHTML = '';
                    addHighlightedText(resultDocOrSection, doc.title, 0, doc.title.length, titlePositions);
                }

                if (contentPositions.length > 0) {
                    contentPositions.sort(function(p1, p2){ return p1.highlight[0] - p2.highlight[0]; });
                    var contentPosition = contentPositions[0];
                    var previewPosition = {
                        highlight: [contentPosition.highlight],
                        previewStart: contentPosition.previewStart,
                        previewEnd: contentPosition.previewEnd,
                        ellipsesBefore: contentPosition.ellipsesBefore,
                        ellipsesAfter: contentPosition.ellipsesAfter
                    };
                    var previewPositions = [previewPosition];
                    for (var p = 1; p < contentPositions.length; p++) {
                        contentPosition = contentPositions[p];
                        if (previewPosition.previewEnd < contentPosition.previewStart) {
                            previewPosition = {
                                highlight: [contentPosition.highlight],
                                previewStart: contentPosition.previewStart,
                                previewEnd: contentPosition.previewEnd,
                                ellipsesBefore: contentPosition.ellipsesBefore,
                                ellipsesAfter: contentPosition.ellipsesAfter
                            };
                            previewPositions.push(previewPosition);
                        } else {
                            previewPosition.highlight.push(contentPosition.highlight);
                            previewPosition.previewEnd = contentPosition.previewEnd;
                            previewPosition.ellipsesAfter = contentPosition.ellipsesAfter;
                        }
                    }

                    var resultPreviews = document.createElement('div');
                    resultPreviews.classList.add('search-result-previews');
                    resultLink.appendChild(resultPreviews);

                    var content = doc.content;

                    for (var q = 0; q < Math.min(previewPositions.length, 2); q++) {
                        var position = previewPositions[q];
                        var resultPreview = document.createElement('div');
                        resultPreview.classList.add('search-result-preview');
                        resultPreviews.appendChild(resultPreview);

                        if (position.ellipsesBefore) {
                            resultPreview.appendChild(document.createTextNode('... '));
                        }
                        addHighlightedText(resultPreview, content, position.previewStart, position.previewEnd, position.highlight);
                        if (position.ellipsesAfter) {
                            resultPreview.appendChild(document.createTextNode(' ...'));
                        }
                    }
                }
            }

            function addHighlightedText(parent, text, start, end, positions) {
                var idx = start;
                for (var i in positions) {
                    var position = positions[i];
                    var span = document.createElement('span');
                    span.innerHTML = text.substring(idx, position[0]);
                    parent.appendChild(span);
                    idx = position[0] + position[1];
                    var highlight = document.createElement('span');
                    highlight.classList.add('search-result-highlight');
                    highlight.innerHTML = text.substring(position[0], idx);
                    parent.appendChild(highlight);
                }
                var span = document.createElement('span');
                span.innerHTML = text.substring(idx, end);
                parent.appendChild(span);
            }
        }

        if (searchTrigger) {
            sj.addEvent(searchTrigger, 'click', openModal);
        }

        sj.addEvent(searchInput, 'keyup', function(e) {
            switch (e.keyCode) {
            case 27:
                if (isModal) {
                    closeModal();
                } else {
                    searchInput.value = '';
                    searchInput.blur();
                    hideSearch();
                }
                break;
            case 38:
            case 40:
            case 13:
                e.preventDefault();
                return;
            }
            update();
        });

        sj.addEvent(searchInput, 'keydown', function(e) {
            switch (e.keyCode) {
            case 38:
                e.preventDefault();
                var active = document.querySelector('.search-result.active');
                if (active) {
                    active.classList.remove('active');
                    if (active.parentElement.previousElementSibling) {
                        var previous = active.parentElement.previousElementSibling.querySelector('.search-result');
                        previous.classList.add('active');
                        previous.scrollIntoView({ block: 'nearest' });
                    }
                }
                return;
            case 40:
                e.preventDefault();
                var activeDown = document.querySelector('.search-result.active');
                if (activeDown) {
                    if (activeDown.parentElement.nextElementSibling) {
                        var next = activeDown.parentElement.nextElementSibling.querySelector('.search-result');
                        activeDown.classList.remove('active');
                        next.classList.add('active');
                        next.scrollIntoView({ block: 'nearest' });
                    }
                } else {
                    var first = document.querySelector('.search-result');
                    if (first) {
                        first.classList.add('active');
                    }
                }
                return;
            case 13:
                e.preventDefault();
                var activeEnter = document.querySelector('.search-result.active');
                if (activeEnter) {
                    activeEnter.click();
                } else {
                    var firstResult = document.querySelector('.search-result');
                    if (firstResult) {
                        firstResult.click();
                    }
                }
                return;
            }
        });

        if (searchBackdrop) {
            sj.addEvent(searchBackdrop, 'click', closeModal);
        }

        sj.addEvent(document, 'keydown', function(e) {
            var key = e.keyCode || e.which;
            if (e.shiftKey && key === 83 && !document.body.classList.contains('search-modal-open')) {
                e.preventDefault();
                openModal();
            }
        });
    }

    sj.onReady(searchInit);
})(window.sj = window.sj || {});
