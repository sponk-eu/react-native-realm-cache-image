/*
* (The MIT License)
* Copyright (c) 2015-2016 YunJiang.Fang <42550564@qq.com>
* @providesModule CacheImage
* @flow-weak
*/

'use strict';

import React from 'react';

import TimerMixin from 'react-timer-mixin';

var ReactNative = require('react-native');

var {
    View,
    Image,
    Text,
    StyleSheet,
} = ReactNative;

var fs = require('react-native-fs');
// var TimerMixin = require('react-timer-mixin');
var StorageMgr = require('./storageMgr.js');
var image = require('./image.js');
var md5 = require('./md5.js');


/*list status change graph
*
*STATUS_NONE->[STATUS_LOADING]
*STATUS_LOADING->[STATUS_LOADED, STATUS_UNLOADED]
*
*/
var
STATUS_NONE = 0,
STATUS_LOADING = 1,
STATUS_LOADED = 2,
STATUS_UNLOADED = 3;


var storageMgr = null;
var db = null;
var syncImageSource = {};
var cacheIdMgr = {};


//var CacheImage = React.createClass({

class CacheImage extends React.Component { 

  mixins: [TimerMixin];

	addImageRef(url, size) {
		return new Promise((resolve, reject) => {
      try{
        storageMgr.realm.write(() => {
          realm.create('CacheImage', {
            url: url,
            ref: 1,
            size: size,
            time: parseInt(Date.now()/1000)
          })
        }, true);
        resolve(true);
      }catch(e){
        resolve(false);
      }
		});
	}

	subImageRef(url) {
      var self = this;
	    return new Promise((resolve, reject) => {
        let q = storageMgr.realm.objects('CacheImage').filtered('url="'+url+'"');
        if(q.length){
          let item = q[0];
          let ref = item.ref;
          let size = item.size;
          if(ref == 1){
            storageMgr.realm.delete(item);
            fs.unlink(storageMgr.getCacheFilePath(url));
            storageMgr.updateStorage(-size);
          }else{
            storageMgr.realm.write(() => {
              storageMgr.realm.create('CacheImage', {
                url: url,
                ref: ref-1
              })
            }, true);
          }
          resolve(true);
        }else{
          resolve(false);
        }
		});
	}

  checkCacheId(id, url, size) {
    var self = this;

    return new Promise((resolve, reject) => {
      let q = storageMgr.realm.objects('CacheID').filtered('id="'+id+'"');
      try{
        if(q.length){
          let item = q[0];
          let oldurl = item.url;
          if(url !== oldurl ){
            storageMgr.realm.write(() => {
              storageMgr.realm.create('CacheID', {
                id: id,
                url: url
              });
              self.addImageRef(url, size);
              self.subImageRef(oldurl);
              self.unlock();
              resolve(true);
            }, true);
          }else{
            self.unlock();
            resolve(true);
          }
        }else{
          storageMgr.realm.write(() => {
            storageMgr.realm.create('CacheID', {
              id: id,
              url: url
            });
            self.addImageRef(url, size);
            self.unlock();
            resolve(true);
          }, true);
        }
      }catch(e){
        resolve(false);
        self.unlock();
      }
    });
  }
  deleteCacheImage(storage) {
    var self = this;
    return new Promise((resolve, reject) => {
      let q = storageMgr.realm.objects('CacheImage').sorted('time').slice(0,1);
      let _q = storageMgr.realm.objects('CacheImage').filtered('id="'+q.id+'"');
      if(_q.length){
        let item = _q[0];
        let url = item.url;
        let size = item.size;
        storageMgr.realm.objects('CacheImage').remove(item);
        let item2 = storageMgr.realm.objects('CacheID').filtered('url="'+q.url+'"');
        storageMgr.realm.objects('CacheID').remove(item2);
        storage -= szie;
        fs.unlink(storageMgr.getCacheFilePath(url));
        storageMgr.updateStorage(-size);
        resolve(storage);
      }
    });
  } 
  checkCacheStorage(size) {
    var self = this;
    return new Promise(async(resolve, reject) => {
        var storage = storageMgr.storage + size;
        //console.log('target:', storage);
        while (storage >= StorageMgr.CACHE_IMAGE_SIZE) {
            storage = await self.deleteCacheImage(storage);
            //console.log('after:', storage);
        }
        resolve();
    });
  }
  isFileExist(filepath) {
    return new Promise((resolve, reject) => {
      fs.stat(filepath).then((rs) => {
        resolve(true);
      }).catch((err) => {
        resolve(false);
      });
    });
  }
  downloadImage(url, filepath, cacheId, filename) {
      var self = this;
      var ret =  fs.downloadFile({fromUrl: url, background: true, toFile: filepath, progressDivider:100, begin: async (res) => {

      }});
      ret.promise.then( async (res) => {
        if(res.statusCode != 200){
          this.unlock();
          self.setState({
            status:STATUS_UNLOADED,
          });
        }else{
          self.setState({
              status:STATUS_LOADED,
              source:{uri:'file://'+filepath},
          });
          //console.error(res.statusCode);
          //console.log(self.state);
          await self.checkCacheId(cacheId, filename, res.bytesWritten);
          await storageMgr.updateStorage(res.bytesWritten);
          await self.checkCacheStorage(res.bytesWritten);
        }
      }, () => {
        this.unlock();
        self.setState({
          status:STATUS_UNLOADED,
        });
      })

      // .then(async (res)=>{
      //
      // }).catch(
      //     (err)=>{
      //         //console.log(err);
      //         this.unlock();
      //         self.setState({
      //             status:STATUS_UNLOADED,
      //         });
      //     }
      // );
  }
  checkImageSource(cacheId, url) {
    var type = url.replace(/.*\.(.*)/, '$1');
    if(type.length < 3 || type.length > 4){
      // TODO: dynamic url to take mime type what is using image
      //  type = this.getMimeType(url);
      type = 'jpg';
    }
    var filename =  md5(url)+'.'+type;
    var filepath = storageMgr.getCacheFilePath(filename);
    this.param = {cacheId:cacheId, url:url, filename:filename, filepath:filepath};
    this.syncCheckImageSource();
  }

  lock() {
      syncImageSource[this.param.filename] = true;
  }

  unlock() {
      delete syncImageSource[this.param.filename];
  }

  islock() {
      return syncImageSource[this.param.filename];
  }

  syncCheckImageSource() {
      if (this.islock()) {
          this.setTimeout(this.syncCheckImageSource, 100);
      } else {
          this.doCheckImageSource();
      }
  }

  async doCheckImageSource() {
      var {cacheId, url, filename, filepath} = this.param;
      this.lock();
      var isExist = await this.isFileExist(filepath);
      //console.log(this.param);
      //console.log('Is File exist', isExist);
      if (isExist) {
          this.setState({
            status:STATUS_LOADED,
            source:{uri:'file://'+filepath},
          });
          //console.log(this.state);
          this.checkCacheId(cacheId, filename);
      } else {
          this.downloadImage(url, filepath, cacheId, filename);
      }
  }

  getInitialState() {
      return {
          status:STATUS_NONE,
      }
  }

  componentWillMount() {
      var {cacheId, url} = this.props;
      if (cacheIdMgr[cacheId]) {
          console.error('duplicate cacheId');
          return;
      }
      cacheIdMgr[cacheId] = true;
      this.setState({status:STATUS_LOADING});
      this.checkImageSource(cacheId, url);
  }

  componentWillUnmount() {
      delete cacheIdMgr[this.props.cacheId];
  }

  renderLoading() {
      return (
          <Image
              {...this.props}
              style={[this.props.style, {justifyContent:'center', alignItems:'center'}]}
              source={this.props.defaultImage}
              >
              <Image
                style={styles.spinner}
                source={{
                  uri: 'data:image/gif;base64,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',
                  isStatic: true
                }}
              >
              </Image>
              {this.props.children}
          </Image>
      );
  }

  renderLocalFile() {
    let _source = this.state.source;

    return (
      <Image
          {...this.props}
          source={_source}
          >
          {this.props.children}
      </Image>
    );
  }

  updateSize(){
    try{
      let _this = this;
      if(this.props.getSize){
        Image.getSize((this.state.status === STATUS_LOADED) ? this.state.source.uri : this.props.defaultImage, (width, height) => {
          this.props.getSize(_this, width, height);
        });
      }
    }catch(e){}
  }

  render() {

    if(this.state.status !== STATUS_LOADING){
      this.updateSize();
    }

    if (this.state.status === STATUS_LOADING) {
        return this.renderLoading();
    } else if (this.state.status === STATUS_LOADED) {
        return this.renderLocalFile();
    } else {
      return (
        <Image
          {...this.props}
          source={this.props.defaultImage}
          >
          {this.props.children}
        </Image>
      )
    }
  }

}

CacheImage.getSchemaRealm = StorageMgr.getSchema;

CacheImage.setup = (realm) => {
  storageMgr = new StorageMgr(realm);
  db = storageMgr.db;
  CacheImage.clear = storageMgr.clear;
};

module.exports = CacheImage;

var styles = StyleSheet.create({
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 25,
    height: 25,
    backgroundColor: 'transparent',
  },
});
