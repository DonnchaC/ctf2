
var selectedFile = null;
var selectedFileName = null
var currentUpload = null;


var timeDiff  =  {
    setStartTime:function (){
        d = new Date();
        time  = d.getTime();
    },

    getDiff:function (){
        d = new Date();
        return (d.getTime()-time);
    }
}

function uploadProgress(evt) {

    if (evt.lengthComputable) {

        var percent = Math.round(evt.loaded * 100 / evt.total);

        $('#upload-progress').css('width', percent + '%');
    }
}

function uploadComplete(evt) {

    $('#upload-progress').css('width', '100%');

    var response_type = this.getResponseHeader('Content-Type');

    if (response_type == 'application/json') {

        var response = $.parseJSON(this.responseText);

        /* wait 1 second before redirection to allow the progress bar
          reach 100% and create a better psychological effect */

        window.setTimeout(function(response){
            /* We have got a JSON response from /upload/. If file upload was successfully redirect to recent uploads
               else we want to display returned error message*/
               
            if (response.status == 'success'){
                window.location.href = '/recent-leaks/?sha256=' + response.sha256 + '&success=1';
            } else {
                // Hide upload dialog and display error message
                $('#dlg-upload-progress').modal('hide');
                $('div#dlg-upload-error .error-message').html(response.info);
                $('#dlg-upload-error').modal('show');
            }

        }, 1000, response);
    }
    else {

        /* wait 1 second before changing the dialog to allow the progress bar
          reach 100% and create a better psychological effect */

        window.setTimeout(function(response){

            $('#dlg-upload-progress').html(response);
            $('#dlg-upload-progress').show();

        }, 1000, this.responseText );
    }
}

function uploadFailed(evt) {
    alert("There was an error attempting to upload the file.");
}


function cancelUpload(){

    if (currentUpload) {
        currentUpload.abort();
    }
}

function uploadFile(filename, file, sha256) {


    /* send a GET request first to ask if the file
       already exists and get the upload URL */

    var data = {};

    if (sha256)
        data = {'sha256': sha256};

    $.ajax({
        type: 'GET',
        async: true,
        url: '/check/',
        dataType: 'json',
        data: data,
        context: {'filename': filename},
        cache: false,
        success: function(response){

            // Need to return suitable message if file exists
            if (response.file_exists) {
                $('#dlg-upload-progress').modal('hide');
                window.location.href = '/recent-leaks/?sha256=' + sha256 + '&exists=1';
            }
            else {

                /* if browser have FormData support send the file via XMLHttpRequest
                   with upload progress bar, else send it the standard way */

                if ( file && window.FormData) {

                    var fd = new FormData();

                    fd.append('file', file);
                    fd.append('ajax','true');

                    /* Due to a bug in AppEngine (http://code.google.com/p/googleappengine/issues/detail?id=5175)
                      we have to send the IP of the user as a param in this post. The server is sending us the IP
                      it saw in the GET request, so we can send it back in the POST. This workaround should be removed
                      when the issue is solved */

                    if (sha256)
                        fd.append('sha256', sha256);

                    currentUpload = new XMLHttpRequest();

                    currentUpload.upload.addEventListener('progress', uploadProgress, false);
                    currentUpload.addEventListener('load', uploadComplete, false);
                    currentUpload.addEventListener('error', uploadFailed, false);
                    currentUpload.open('POST', response.upload_url);
                    currentUpload.send(fd);

                } else {

                    $('#frm-file').attr('action', response.upload_url);
                    $('#frm-file').submit();

                    /*  in IE 7 animated GIFs freeze immediately after submit, we need this hack to reload the GIF and make the
                        animation work during the file upload */

                    $('#gif-upload-progress-bar span').html('<img style="display:block" src="/static/img/bar.gif">');
                }
            }
        }
    }); // $.ajax()
}


function canUserWorker() {

    if (window.FileReader && window.Worker) {

        var major_version = parseInt(jQuery.browser.version, 10);

        if (jQuery.browser.opera)
          return false;

        if (jQuery.browser.mozilla && major_version >= 8)
          return true;

        if (jQuery.browser.webkit && major_version >= 535)
          return true;
    }

    return false;
}

function scanFile(evt) {

    if (!selectedFileName) {
        return;
    }

    if (selectedFile && selectedFile.size > 2*1024*1024) {
        $('#dlg-file-too-large').modal('show');
        return;
    }

    $('#dlg-upload-progress').modal('show');

    /* if browser has support for File API and Web Workers, calculate hash before upload
       in a separate thread. Opera supports both, but its postMessage implementation doesn't
       allow to pass a File object as a parameter, so we can't send the file to the worker  */

    if (canUserWorker()){

        $('#upload-progress-bar').hide();
        $('#hash-progress').css('width','0%');
        $('#hash-progress-bar').show();

        worker = new Worker('/static/js/sha256.js');

        worker.onmessage = function(e) {

            if (e.data.progress) {

                $('#hash-progress').css('width', e.data.progress + '%');
            }
            else {

                $('#hash-progress-bar').hide();
                $('#upload-progress').css('width','0%');
                $('#upload-progress-bar').show();

                uploadFile(selectedFileName, selectedFile, e.data.sha256);
            }
        };

        worker.postMessage({file: selectedFile});
    }
    else {

        $('#gif-upload-progress-bar').show();
        uploadFile(selectedFileName, null, null);

    }
}

function selectFile(evt) {

    /* update global selectedFile variable */

    if (evt.target.files) {
        selectedFile = evt.target.files[0];
    }

    /* when the hidden file input box changes its content,
       update also the visible GUI element  */
    var pieces = $(this).val().split(/(\\|\/)/g);
    selectedFileName = pieces[pieces.length-1];

    $('#file-name').text(selectedFileName);
    $("#btn-scan-file").focus();
}


jQuery(document).ready(function(){

    $('.action').click(function(event) {
        var id = $(this).attr('id');
        $('input#' + id).select();
    });

    /* file scanning */
    $('#btn-scan-file').click(scanFile);
    $('input#file-choosen').change(selectFile);

    $('.btn.dialog').click(function () {
        $(this).siblings('.loading').show();
        $(this).siblings('.btn').addClass('disabled');
        $(this).addClass('disabled');
    });

});
