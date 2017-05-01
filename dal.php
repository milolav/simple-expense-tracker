<?php
error_reporting(0);

$db = new JsonDb();

//handle get request
if(array_key_exists("get", $_GET)) {
    send_response(json_encode($db->getAll()), 0, true);
}

//handle upsert request
if(array_key_exists("upsert", $_GET)) {
    $inputData = file_get_contents("php://input");
    if(strlen($inputData) < 2) { send_error(); }

    $expenseObject = json_decode($inputData);
    if(json_last_error() != JSON_ERROR_NONE) { send_error(json_last_error_msg()); }

    if(!property_exists($expenseObject, "date") || !property_exists($expenseObject, "amount")) {
        send_error("Unexpected object");
    }
    //convert json datetime to simple Y-m-d
    $expenseObject->date = date('Y-m-d', strtotime($expenseObject->date));
    $id = $db->upsert($expenseObject);
    ($id === false) ? send_error($db->getErrorMessage(), $db->getErrorCode()) : send_response($id);
}

//handle delete request
if(array_key_exists("delete", $_GET)) {
    $inputData = file_get_contents("php://input");
    if(strlen($inputData) < 2) { send_error(); }

    $deleteObject = json_decode($inputData);
    if(json_last_error() != JSON_ERROR_NONE) { send_error(json_last_error_msg()); }

    if(!property_exists($deleteObject, "id")) {
        send_error("Missing id value", 2);
    }
    $db->delete($deleteObject->id);
    send_response();
}

send_error();
//End of execution

// DBCLASS
class JsonDb {
    private $dataRecords;
    private $maxId = 1;
    private $errorObject = null;

    public function __construct() {
        //load data.json file or ser to the empty array of not.
        $dataJson = "";
        if(file_exists("data.json")) {
            $fileContents = file_get_contents("data.json");
            //strip utf8 header
            $dataJson = substr($fileContents, 0, 3)=="\xEF\xBB\xBF" ? substr($fileContents, 3) : $s;
        }
        if(empty($dataJson)) { $dataJson = "[]"; }

        $this->dataRecords = json_decode($dataJson);
        if(json_last_error() != JSON_ERROR_NONE) { send_error(json_last_error_msg(), 500); }
        $this->maxId = $this->dataRecords[count($this->dataRecords)-1]->id;
    }

    public function getAll() {
        return $this->dataRecords;
    }

    public function upsert($expenseObject) {
        if(property_exists($expenseObject, "id")) {
            return $this->update($expenseObject->id, $expenseObject);
        }else{
            return $this->add($expenseObject);
        }
    }
    public function update($id, $expenseObject) {
        $found = false;
        foreach($this->dataRecords as &$record) {
            if($record->id != $id) { continue; }
            foreach($expenseObject as $k => $v) { $record->{$k} = $v; }
            $found = true;
            break;
        }
        if(!$found) { 
            $this->error("Unknown id value.", 3);
            return false;
        }
        $this->save("u".$id);
        return $id;
    }

    public function add($expenseObject) {
        $id = $this->maxId + 1;
        $expenseObject->id = $id;
        $this->dataRecords[] = $expenseObject;
        $this->save("a".$id);
        return $id;
    }

    public function delete($id) {
        $pos = -1;
        for($i = 0; $i < count($this->dataRecords); $i++) {
            if($this->dataRecords[$i]->id != $id) { continue; }
            $pos = $i;
            break;
        }
        if($pos == -1) { 
            $this->setError("Unknown id value.", 3);
            return false;
        }
        array_splice($this->dataRecords, $pos, 1);
        $this->save("d".$id);
        return true;
    }

    public function getError() {
        return $this->errorObject;
    }

    public function getErrorCode() {
        return $this->errorObject->code;
    }

    public function getErrorMessage() {
        return $this->errorObject->message;
    }

    private function setError($message, $code) {
        $this->errorObject = (object)["code"=>$code, "message"=>$message];
    }

    private function save($action) {
        $dataJson = json_encode($this->dataRecords, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        copy("data.json", "old_data/data-".time()."-".$action.".json");
        file_put_contents("data.json", "\xEF\xBB\xBF".$dataJson);
    }
}

//GLOBAL FUNCTIONS
function send_error($errorText="Bad request", $returnCode=400) {
    http_response_code(400);
    header("Content-Type: application/json;charset=utf-8");
    echo json_encode(array("return_code"=>$returnCode, "error_text"=>$errorText, "data"=>null));
    exit();
}

function send_response($returnData=null, $returnCode=0, $returnRaw=false) {
    header("Content-Type: application/json;charset=utf-8");
    if($returnRaw) {
        echo $returnData;
    }else {
        echo json_encode(array("return_code"=>$returnCode, "error_text"=>null, "data"=>$returnData));
    }
    exit();
}


?>