// Supertext Translation for Wix: the little the dashboard pages do in the browser.
// Every request to the app's API carries the signed Wix instance in a header.
(function () {
  'use strict';
  var body = document.body;
  var instance = body.getAttribute('data-instance') || '';
  var locale = body.getAttribute('data-locale') || 'en';

  function api(method, path, data) {
    return fetch(path + (path.indexOf('?') < 0 ? '?' : '&') + 'locale=' + encodeURIComponent(locale), {
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Wix-Instance': instance },
      body: data ? JSON.stringify(data) : undefined,
    }).then(function (response) {
      return response.json().then(function (json) {
        return { ok: response.ok, json: json };
      });
    });
  }

  // --- Translate page -------------------------------------------------------
  var form = document.getElementById('translate-form');
  var schemaSelect = document.getElementById('schema-select');
  if (schemaSelect) {
    schemaSelect.addEventListener('change', function () {
      window.location.href = schemaSelect.value;
    });
  }

  if (form) {
    var button = document.getElementById('translate-button');
    var message = document.getElementById('form-message');
    var selectAll = document.getElementById('select-all');
    var selectAllText = document.getElementById('select-all-text');
    var overwrite = document.getElementById('overwrite');
    var warning = document.getElementById('overwrite-warning');
    var hint = document.getElementById('overwrite-hint');
    var entities = function () {
      return Array.prototype.slice.call(form.querySelectorAll('input[name="entity"]'));
    };
    var checked = function (name) {
      return Array.prototype.slice
        .call(form.querySelectorAll('input[name="' + name + '"]:checked'))
        .map(function (input) {
          return input.value;
        });
    };
    var updateButton = function () {
      var count = checked('entity').length;
      var label = button.getAttribute('data-label');
      if (count > 0) {
        var plural = new Intl.PluralRules(locale).select(count) === 'one' ? 'data-label-one' : 'data-label-other';
        label = button.getAttribute(plural).replace('{count}', String(count));
      }
      button.textContent = label;
      var all = entities();
      var allChecked = all.length > 0 && all.every(function (input) {
        return input.checked;
      });
      if (selectAll) selectAll.checked = allChecked;
      if (selectAllText) selectAllText.checked = allChecked;
    };
    var toggleAll = function (event) {
      entities().forEach(function (input) {
        input.checked = event.target.checked;
      });
      updateButton();
    };
    if (selectAll) selectAll.addEventListener('change', toggleAll);
    if (selectAllText) selectAllText.addEventListener('change', toggleAll);
    form.addEventListener('change', function (event) {
      if (event.target && event.target.name === 'entity') updateButton();
    });
    if (overwrite) {
      overwrite.addEventListener('change', function () {
        warning.hidden = !overwrite.checked;
        hint.hidden = overwrite.checked;
      });
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var entityIds = checked('entity');
      var locales = checked('locale');
      if (entityIds.length === 0 || locales.length === 0) {
        message.textContent = button.getAttribute('data-select');
        return;
      }
      message.textContent = '';
      button.disabled = true;
      button.textContent = button.getAttribute('data-starting');
      api('POST', '/api/jobs', {
        schemaId: form.getAttribute('data-schema'),
        entityIds: entityIds,
        locales: locales,
        overwrite: overwrite && overwrite.checked,
      }).then(function (result) {
        if (!result.ok) {
          button.disabled = false;
          updateButton();
          message.textContent = (result.json.error && result.json.error.message) || 'Error';
          return;
        }
        poll(result.json.id, function () {
          button.disabled = false;
          updateButton();
        });
      });
    });
    updateButton();
  }

  var panel = document.getElementById('job-panel');
  function poll(id, finished) {
    api('GET', '/api/jobs/' + encodeURIComponent(id)).then(function (result) {
      if (!result.ok) return;
      panel.innerHTML = result.json.html;
      if (result.json.status === 'running') {
        setTimeout(function () {
          poll(id, finished);
        }, 2000);
      } else if (finished) {
        finished();
      }
    });
  }
  if (panel && panel.getAttribute('data-job')) poll(panel.getAttribute('data-job'));

  // --- Translation files: export for translation, import translation ---------
  var exportCard = document.getElementById('export-card');
  if (exportCard && form) {
    var exportButton = document.getElementById('export-button');
    var exportMessage = document.getElementById('export-message');
    exportButton.addEventListener('click', function () {
      var entityIds = checked('entity');
      if (entityIds.length !== 1) {
        exportMessage.textContent = exportCard.getAttribute('data-select-one');
        return;
      }
      var formatInput = exportCard.querySelector('input[name="file-format"]:checked');
      var locales = Array.prototype.slice
        .call(exportCard.querySelectorAll('input[name="export-locale"]:checked'))
        .map(function (input) {
          return input.value;
        });
      exportMessage.textContent = '';
      exportButton.disabled = true;
      fetch('/api/files/export?locale=' + encodeURIComponent(locale), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wix-Instance': instance },
        body: JSON.stringify({
          schemaId: exportCard.getAttribute('data-schema'),
          entityIds: entityIds,
          locales: locales,
          format: formatInput ? formatInput.value : 'xliff',
        }),
      })
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (json) {
              exportMessage.textContent = json.text || (json.error && json.error.message) || 'Error';
            });
          }
          var disposition = response.headers.get('content-disposition') || '';
          var match = /filename="([^"]+)"/.exec(disposition);
          return response.blob().then(function (blob) {
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = match ? match[1] : 'wix-supertext.xlf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () {
              URL.revokeObjectURL(url);
            }, 10000);
          });
        })
        .catch(function (error) {
          exportMessage.textContent = String(error);
        })
        .then(function () {
          exportButton.disabled = false;
        });
    });
  }

  var importForm = document.getElementById('import-form');
  if (importForm) {
    var importButton = document.getElementById('import-button');
    var importMessage = document.getElementById('import-message');
    var importResult = document.getElementById('import-result');
    importForm.addEventListener('submit', function (event) {
      event.preventDefault();
      importResult.innerHTML = '';
      var data = new FormData(importForm);
      var file = data.get('file');
      if (file && file.size > 10 * 1024 * 1024) {
        importMessage.textContent = importForm.getAttribute('data-too-large');
        return;
      }
      var label = importButton.textContent;
      importButton.disabled = true;
      importButton.textContent = importForm.getAttribute('data-importing');
      importMessage.textContent = '';
      fetch('/api/files/import?locale=' + encodeURIComponent(locale), {
        method: 'POST',
        headers: { 'X-Wix-Instance': instance },
        body: data,
      })
        .then(function (response) {
          return response.json().then(function (json) {
            if (!response.ok) {
              importMessage.textContent = json.text || (json.error && json.error.message) || 'Error';
              return;
            }
            // Server-rendered (escaped) summary.
            importResult.innerHTML = json.html || '';
          });
        })
        .catch(function (error) {
          importMessage.textContent = String(error);
        })
        .then(function () {
          importButton.disabled = false;
          importButton.textContent = label;
        });
    });
  }

  // --- Settings page --------------------------------------------------------
  var test = document.getElementById('test-button');
  if (test) {
    var resultText = document.getElementById('test-result');
    test.addEventListener('click', function () {
      var label = test.textContent;
      test.disabled = true;
      test.textContent = test.getAttribute('data-testing');
      resultText.textContent = '';
      resultText.className = '';
      var keyInput = document.querySelector('input[name="apiKey"]');
      api('POST', '/api/test', { apiKey: keyInput ? keyInput.value : '' }).then(function (result) {
        test.disabled = false;
        test.textContent = label;
        // Server-rendered (escaped) key check message with its links.
        resultText.innerHTML = result.json.html || '';
        resultText.className = result.json.ok ? 'ok' : 'failed';
      });
    });
  }
})();
