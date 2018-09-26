/*
AtCoderNotifier
実行すると指定したユーザー（複数でもok）の提出をチェックし、前回の実行以降にACを提出していればその旨をslackに投稿する。
IFTTTやcronなどを使い一定時間ごとに実行すれば、人々のACを定期的に知らせてくれるbotになる。
*/


/*
postSlack
textで指定した文字列をslackに投稿する関数。予め https://api.slack.com/apps からbotの登録と投稿先urlの取得をする必要がある。
参考（というかそのまま…）: https://vaaaaaanquish.hatenablog.com/entry/2017/09/27/184352
*/
function postSlack(text){
  var url = "XXX";//投稿先url
  var options = {
    "method" : "POST",
    "headers": {"Content-type": "application/json"},
    "payload" : '{"text":"' + text + '"}'
  };
  UrlFetchApp.fetch(url, options);
}

/*
generateURL
AtCoder非公式APIへのurlを作成する関数。apiのurl: https://github.com/kenkoooo/AtCoderProblems/
https://kenkoooo.com/atcoder/atcoder-api/results?user=${自分のid} のあとに
&rivals=AAA,BBB,CCC,.... をつけることで、自分とAAA,BBB,CCC...さんが今までに出したすべての提出をjson形式で取得できる。
引数のtargetsには取得したい人のidがリスト形式で入っているので、forで取り出し、urlの後ろにくっつけていく。
*/

function generateURL(targets){
  var res="https://kenkoooo.com/atcoder/atcoder-api/results?user=XXX&rivals=";//XXXに自分のidを入れる
  for(var i=0;i<targets.length;i++){
    res+=targets[i]+",";
  }
  return res.slice(0,-1);//urlの最後に余分な,がついているので取り除く
}
/*
hash
文字列のmd5ハッシュを16進文字列で返す関数。
参考（ほぼそのまま）: https://stackoverflow.com/questions/16216868/get-back-a-string-representation-from-computedigestalgorithm-value-byte
*/
function hash(s){
  var diget = Utilities.computeDigest( Utilities.DigestAlgorithm.MD5, s);
  var md5_hash = '';
    for (i = 0; i < diget.length; i++) {
      var byte = diget[i];
      if (byte < 0)
        byte += 256;
      var byteStr = byte.toString(16);
      if (byteStr.length == 1) byteStr = '0'+byteStr;
      md5_hash += byteStr;
    }
  return md5_hash;
}
/*
writeJSON
jsonをgdrive上のファイルへ書き込む関数。予めファイルへのurlを取得しておく必要がある。
（gdriveで対象ファイルを右クリック→共有可能なリンクを取得）。
*/
function writeJSON(s) {
  var file = DriveApp.getFileById('XXX');//ファイルへのリンク
  file.setContent(JSON.stringify(s));
}

/*
readJSON
gdriveのファイルからjsonを読み込む関数。予めファイルへのurlを取得しておく必要がある。
*/
function readJSON() {
  var file = DriveApp.getFileById('XXX');//ファイルへのリンク
  var data = file.getBlob().getDataAsString();
  if data=="" data="{}" //ファイルが空だった場合、jsonに置き換える
  var ret=JSON.parse(data);
  return ret;

}

/*
doPost
メイン部分。doPostという名前にしておくことで、このGASのurlにpostすると自動で実行されるようになる。
targetsに通知を受け取りたい人のidを入れておく。
checked_submitsには前回までの実行で取得した提出が入る。checked_submits[id]とすると、idが過去にACした提出の情報をハッシュ化したもののリストが返ってくる。
例 checked_submits["sbite"]=["e300530d4670d96cc410441d071e40b4","01122c55b9512d16f977ffa218dbdf0c",...]
newtargetsには前回の実行でtargetsに指定されていないidが入り、newtargetに入っているかどうかで処理を分けている。
これがないと、新しくidを追加したとき、そのidがいままでにACしたすべての提出がslackに流れる。
*/
function doPost(){
  var targets=[];//例 ["tourist","chokudai"]
  var checked_submits=readJSON();//gdrive上に保存したファイルから、checked_submitsを復元。
  var newtargets=[];

  var url = generateURL(targets);
  var response = UrlFetchApp.fetch(url).getContentText();//apiから結果を取得
  var json = JSON.parse(response);//結果はjson形式を要素に持つリストの形をした文字列で返ってくるので、パースする
  var header="--------AtCoderNotifier--------\n"//通知冒頭につけるヘッダ（あるとかっこいい）
  var text="";//本文
  /*
  提出の情報を一つずつ見ていく。json[i]にはi番目の提出情報が書かれている。json[i]["user_id"]でその提出をしたユーザーのidを、json[i]["result"]で提出の結果（AC,WA,TLE...）を、
  json[i]["problem_id"]で提出先の問題idを取得できる。
  */
  for(var j=0;j<json.length;j++){
    var user=json[j]["user_id"];
    var result=json[j]["result"];
    var problem=json[j]["problem_id"];
    if (checked_submits[user]==undefined){//checked_submits中にuserが存在しない場合、今回の実行で新しく指定されたuserとして扱う。
      checked_submits[user]]=[];//userをキーにした空リストを登録。
      newtargets.push(user);
      text+=user+"を追加しました！\n"
    }
    if(result=="AC" && checked_submits[user].indexOf(hash(JSON.stringify(json[j])))==-1){　//結果がACかつ今までに取得していない提出なら
      checked_submits[user].push(hash(JSON.stringify(json[j])));
      if (newtargets.indexOf(user)==-1)text+=user+"が"+problem+"を通しました！\n";　//newtargetsでないならtextに追記
      }
  }
  if (text!=""){//本文が空でない（誰かが新しくACした or userの追加があった）なら
    writeJSON(checked_submits);//更新
    postSlack(header+text);//投稿
  }
}
