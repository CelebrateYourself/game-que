; (function(w, d){
              'use strict';
                            
              var isArray = function(ar){               
                return ('isArray' in Array) ? Array.isArray(ar) : Array.prototype.isPrototypeOf(ar);
              };
              
              /*************************************************************
               **  Простой итератор - перебор элементов последовательности
               **  методом iter.next
               **/
              var iter = function(seq){
                return {
                  _data: seq,
                  _pos: 0,
                  
                  next: function(){
                    if(!this._data.length) throw('Invalid sequence');
                    var cur;
                    if(this._pos >= this._data.length) {
                      delete this._data;
                      throw Error('StopIteration');
                    }
                    cur = this._data[this._pos];
                    this._pos += 1;
                    return cur;
                  }
                };
              };
              
              
              /*******************************************************
               **  Бесконечный итератор по последовательности
               **  со свойством  length
               **/
              var inf = function(seq){
                var res = iter(seq);
                res.next = function(){
                  var cur;
                    if(this._pos > this._data.length) {
                      delete this._data;
                      throw Error('StopIteration');
                    }
                    cur = this._data[this._pos];
                    this._pos = (this._pos + 1) % this._data.length;
                    return cur;
                };
                
                return res;
              }; 
              
              /*********************************************************************
               **  Объект-множество key: value
               **
               **     .set :  Fucntion  -  добавить элемент в множество, или Error
               **        @argument :  name<String>  -  уникальное имя
               **        @argument :  value<Any>
               **
               **     .get :  Funtcion  -   возвращает значение по имени или Error
               **        @argument :  name<String>
               **        @return   :  <Any>
               **
               **     .delete :  Function  -  удалить элемент из множества, если есть
               **        @argument : name<String>
               **
               **     .contains :  Function  -  содержится ли элемент с именем в множестве
               **        @argument :  name<String>
               **        @return   :  Boolean
               **   
               **     .clear :  Function  -  очищает объект-множество
               **     .list  :  Function  -  возвразает массив элементов множества (ссылки!)
               **     .length  :  Integer  -  количество элементов множества (read only)
               **/
              var set = (function(){
                var set = function(){
                  if(!(this instanceof set)){
                    return new set();
                  }
                  
                  Object.defineProperty(this, '_content', {
                    writable: false,
                    enumerable: false,
                    configurable: false,
                    value: {}
                  });
                };
				
                /***************  METHODS  ***********************/
                set.prototype.set = function(name, value){
                  try {
                    if(!name || this.contains(name)) throw Error();
                    this._content[name] = value;
                  } catch(e){
                    throw Error('set.set: can not set "' + name + '"');
                  }
                };
                /***********************************************/
                set.prototype.get = function(name){
                  try {
                    if(!this.contains(name)) throw Error(); 
                    return this._content[name];
                  } catch(e){
                    throw Error('set.get: the name "' + name + '" is not in set');
                  }
                };
                /***********************************************/
                set.prototype.delete = function(name){
                  try {
                    if(this.contains(name)) delete this._content[name];
                  } catch(e){
                    throw Error('set.delete: can not delete "' + name + '"');
                  }
                };
                /***********************************************/
                set.prototype.clear = function(){
                  for(var pr in this._content){
                    delete this._content[pr];
                  }
                };
                /***********************************************/
                set.prototype.contains = function(name){
                  
                  return name in this._content && 
                     this._content.hasOwnProperty(name) &&
                     this._content.propertyIsEnumerable(name);
                };
                /***********************************************/
                set.prototype.list = function(){
                  return Object.values(this._content);
                };
                /***********************************************/
                Object.defineProperty(set.prototype, 'length', {
                  enumerable: false,
                  configurable: false,
                  get: function(){
                    return Object.keys(this._content).length;
                  }
                });
                
                return set;
              }());
              
              /**********************************************************************
               **   Вызывает для каждого элемента итератора it функцию fn(element)
               **
               **  @argument: it<iter>
               **  @argument: fn<Function>
               **  @return:   undefined
               **/
              var walk = function(it, fn){
                       var pos;
                       while(true){
                         try {
                           pos = it.next();
                         } catch(e){
                           break;
                         }
                         fn(pos);
                       }
                     };
                     
               /**********************************************************************
               **   Вызывает для каждого элемента итератора it функцию fn(element),
               **   возвращает итератор по результатам выполнения ф-ции
               **
               **  @argument: it<iter>
               **  @argument: fn<Function>
               **  @return:   iter
               **/      
               var map = function(it, fn){
                       var pos, res = [];
                       while(true){
                         try {
                           pos = it.next();
                         } catch(e){
                           break;
                         }
                         res.push(fn(pos));
                       }
                       return iter(res);
                     };                 
                              
               /*********************************
                **  Components  POOL  ***********
                *********************************/
                var POOL = set();      
				
                     
              /******************************************
               *****  Thread  ***************************
               ******************************************/
              var Thread = (function(POOL){
                /**  
                 **  .run  :  Function  -  запустить поток
                 **  .close  :  Function  -  закрыть поток
                 **  .getStatus  :  Function  -  возвращает текущий статус потока:
                 **                              CREATED, RUNNED, CLOSED
                 **  .then  :  Function  -  создание цепочки потоков
                 **      @argument :  Thread
                 **
                 **  @argument : Object
                 **    .iter         :  iter      -  итератор
                 **    .interval     :  Integer   -  тик между вызовами
                 **    .delay        :  Integer   -  задержка перед первым запуском
                 **    .target       :  Any       -  инкапсуляция объекта с которым связан поток
                 **    .onOpen()     :  Function  -  вызывается один раз при запуске
                 **    .onChange(ch) :  Function  -  вызывается при каждом тике, ch - шаг итератора
                 **    .onClose()    :  Function  -  вызывается по завершении
                 **
                 **  @return : Thread 
                 **/
                var t = function(settings){
                  
                  if(!(this instanceof t)){
                    return new t(settings);
                  }
                  
                  var self = t;
                  
                  this.iter = settings.iter;
                  this.interval = settings.interval || 0;
                  this.delay = settings.delay || 0;
                  this.target = settings.target;
                  
                  this.onOpen = settings.onOpen;
                  this.onChange = settings.onChange;
                  this.onClose = settings.onClose;
                  
                  /*
                  Object.defineProperty(this, 'id', {
                    value: self._getID(),
                    writable: false,
                    enumerable: true,
                    configurable: false
                  });*/
                  
                  this._status = self.CREATED;
                  
                  //self.DISPATCHER.set(this.id, this);
                  //console.log('start Thread', this.id);
                };

                /*****************  METHODS  ********************/
                t.prototype.run = function(){
                  this._status = t.RUNNED;
                  if(this.onOpen) this.onOpen();
                  setTimeout(this._tick.bind(this), this.delay);
                };
                /***********************************************/
                t.prototype._tick = function(){ 
                  var cur, 
                      self = t;           
                  try {
                    if(this._status === self.CLOSED){
                      throw Error('StopIteration');
                    }  
                    cur = this.iter.next();
                  } catch(e) {
                    this.close();
                    return;
                  } 
                
                  setTimeout(this._tick.bind(this), this.interval);         
                  if(this.onChange) this.onChange(cur);
                };
                /***********************************************/
                t.prototype._clear = function(){ 
                  this.target = null;
                  this.onOpen = null;
                  this.onClose = null;
                  this.onChange = null;
                  this.iter = null;
                  this.interval = null;
                };
                /***********************************************/
                t.prototype.close = function(){
                    var self = t;
                    
                    this._status = self.CLOSED;
                    if(this.onClose) this.onClose();
                    
                    this._clear();
                    //self.DISPATCHER.delete(this.id);
                    //console.log('close Thread', this.id);
                }; 
                
                /***********************************************/
                t.prototype.getStatus = function(){
                  return this._status;
                };                

                /*************************************************
                 **  В завершении текущего потока запускает
                 **  поток-аргумент
                 **
                 **  @argument : Thread 
                 **  @return : Thread
                 **/
                t.prototype.then = function(th){
                  var fn = this.onClose;
                  if(fn) fn = fn.bind(this);
                  
                  this.onClose = function(){
                    if(fn){
                      fn();
                    }
                    th.run();
                  };
                  return this;
                };
                
                /**************** STATIC *******************/               
                t.CREATED = 1;
                t.RUNNED = 2;
                t.CLOSED = 0;
                
                //t.DISPATCHER = set();
                // t._COUNTER = 1;
                               
                /*********************************************
                 **  Возвращает ID потока для диспетчеризации
                 **/
                 /*
                t._getID = function(){
                  var current = this._COUNTER;
                  this._COUNTER += 1;
                  return current;
                }; */

                /***********************************************
                 **  Сбрасывает счетчик _COUNTER потоков
                 **/
                 /*
                  t.reset = function(){
                  this._COUNTER = 1;
                }; */
          
                /************************************************
                 **  Создает синхронную очередь потоков
                 **
                 **  @argument : iter(List<Thread>)
                 **  @return   : Thread 
                 **/
                t.chain = function(threads){
                  
                  var chain = this({
                     iter: inf(' '),
                     target: {
                       threads: threads,
                       current: null,
                       Thread: this
                     },
                     onOpen: function(){
                       var ctx = this.target;
                       try {
                         ctx.current = ctx.threads.next();
                         ctx.current.run();
                       } catch(e){
                         this.close();
                       }
                     },
                     onChange: function(){
                        var ctx = this.target;
                        
                        if(ctx.current.getStatus() === ctx.Thread.CLOSED){
                          try {
                            ctx.current = ctx.threads.next();
                            ctx.current.run();
                          } catch(e){
                            this.close();
                          }
                        }
                     }
                  });
                  
                  return chain;
                };   

                /************************************************************
                 **  Агрегирует и запускает параллельно несколько потоков
                 **
                 **  @argument : iter(List<Thread>)
                 **  @return   : Thread 
                 **/
                t.parallel = function(it){   
                  
                  var process = [];
                  walk(it, process.push.bind(process));
                  
                  return this({
                    iter: inf(' '),
                    target: process,
                    interval: 0,
                    onOpen: function(){
                      this.target.forEach(function(e){
                        e.run();
                      });
                    },
                    onChange: function(nothing){
                      var closed = this.target.every(function(e){
                        return e.getStatus() === Thread.CLOSED;
                      });
                      
                      if(closed){
                        this.close();
                      }
                    }           
                  });
                };
                /***********************************************/
                return t;
              }(POOL));
              
			  POOL.set('Thread', Thread);
			  
              
              /********************************************
               **************  View  **********************  
               ********************************************
               **   Прячем HTML-элементы
               **
               **   View
               **   @argument : Object
               **      .element    :  String  -  CSS-селектор - возвращает существующий
               **                                  элемент или создает новый
               **      .className  :  String  -  строка CSS-классов по правилам HTML
               **      .css        :  Object  -  таблица стилей  {имя : значение, ...}
               **      .id         :  String  - id DOM элемента (если не установлен!)
               **
               **   .append  :  Function   -  интерфейс над HTMLElement.append используется
               **                             при построении Template в SceneBuilder для
               **                             вложенных элементов
               **       @argument  :  View     -  добавляет View.element в конец this.element
               **       @argument  :  Integer  -  числовая позиция (через insertBefore)
               **
               **   .remove  :  Function  -  интерфейс над HTMLElement.removeChild
               **       @argument  :  View      -  удаляет DOMElement из аргумента-View из
               **                               DOMElement текущего View
               **
               **   .text  :  get/set  -  использует View.element.textContent - затирает весь
               **                         контент элемента - использовать только на конечных
               **                         узлах.  
               **   .nodes  :  get/set  - использует View.element.innerHTML - затирает весь
               **                         контент элемента - использовать для задания структуры
               **                         DOM элемента.  
               **   .attach  :  Function  -  устанавливает на DOM элемент обработчик события,
               **                             интерфейс над HTMLElement.addEventListener
               **        @argument  :  String  -  event-name, без приставки on
               **        @argument  :  String  -  имя метода(!) в текущей обертке View - фунуция
               **                                 биндится и вызывается в контексте View, сохраняется
               **                                 в объекте listeners - {event: fn}
               **        @argument  :   Boolean/undefined  -  Boolean аргумент для HTMLElement.addEventListener -
               **                                 устанавливает тип обработчика - перехватывающий/обычный
               **    
               **    .detach  :  Function   -  снимает с DOM элемента обработчики (без аргументов - вообще все).
               **         @argument  :  String  -   event-name, без приставки on (ф-ция достается из ._listeners)
               **         @argument  :   Boolean/undefined  -  Boolean аргумент для HTMLElement.removeEventListener
               **
               **    .clear  :  Function  -  очищает все ссылки и привязки               
               **/
              var View = (function(d, POOL){
              
                var view = function(settings){
                  if(!(this instanceof view)){
                    return new view(settings);
                  }
                  
                  var elt, 
                      name, 
                      ctx, 
                      text = '',
                      self = view;
                  
                  name = settings.element;
                  
                  if(/^[#.]/.test(name)){
                    elt = self._search(name);
                  } else {
                    elt = self._create(name);
                  }
                  
                  Object.defineProperty(this, '_listeners', {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: {}
                  });
                  
                  this.element = elt;
                  
                  if('css' in settings){
                    ctx = settings.css;
                    for(name in ctx){
                      if(ctx.hasOwnProperty(name) && ctx.propertyIsEnumerable(name)){
                        text += name + ':' + ctx[name] + ';'
                      }
                    }
                    this.element.style.cssText += text;
                  }
                  
                  if('className' in settings){
                    this.element.className += ' ' + settings.className;
                  }
                  if('id' in settings){
                    if(!this.element.id){
                      this.element.id = settings.id;
                    }
                  }
                };     
                /**************** STATIC *****************/
                view._create = function(name){
                  var elt = d.createElement(name || 'div');

                  if(!elt){
                    throw Error("Can not create DOM element " + name);
                  }
                  return elt;
                };
                /***********************************************/
                view._search = function(query){
                  return d.querySelector(query);
                };
                /***********************************************/
                view._searchAll = function(query){
                  return d.querySelectorAll(query);
                };
                
                /****************** METHODS ***********************/
                view.prototype.append = function(elt, pos){
                  if(!pos || pos < 1){
                    this.element.appendChild(elt.element);
                  } else {
                    var p, e;
                    for(p = 1, e = this.element.firstElementChild; e; p += 1, e = e.nextElementSibling){
                      if(p === pos){
                        this.element.insertBefore(elt.element, e);
                        return this;
                      }
                    }
                    this.element.appendChild(elt.element);  
                  }
                  return this;
                };  
                /***********************************************/
                view.prototype.remove = function(elt){
                  this.element.removeChild(elt.element);
                };
                /***********************************************/
                view.prototype.attach = function(event, fn_name, type){
                  if(typeof(event) !== 'string') throw Error('View.attach: Incorrect event name: ' + event);
                  if(typeof(fn_name) !== 'string') throw Error('View.attach: Incorrect function name: ' + fn_name);
                  if(!(fn_name in this)) throw Error('View.attach: Undefined method name: ' + fn_name);
                  
                  var fn = this[fn_name].bind(this);
                  this._listeners[event] = fn;
     
                  this.element.addEventListener(event, this._listeners[event], ((type) ? true : false));
                };
               /***********************************************/
                view.prototype.detach = function(event, type){             
                  if(typeof(event) === 'string'){
                    if(this._listeners[event]){
                      this.element.removeEventListener(event, this._listeners[event], ((type) ? true : false));
                      delete this._listeners[event];
                    }
                  } else if(!event){
                    for(var e in this._listeners){
                      this.detach(e, type);
                    }
                  }
                };    
                /***********************************************/
                view.prototype.clear = function(){
                  this.detach();
                  this.text = '';
                  delete this.element;
                };   
                /***********************************************/
                view.prototype.getAttr = function(name){
                  return this.element.getAttribute(name) || '';
                };
                /***********************************************/
                view.prototype.setAttr = function(name, value){
                  return this.element.setAttribute(name, value);
                };
                /***********************************************/
                Object.defineProperties(view.prototype, {
                    'text' : {
                        get: function(){
                            return this.element.textContent;
                        },
                        set: function(value){
                            this.element.textContent = value;
                        },
                        enumerable: true,
                        configurable: false
                    },
                    'nodes': {
                      get: function(){
                            return this.element.innerHTML;
                      },
                      set: function(value){
                          this.element.innerHTML = value;
                      },
                      enumerable: true,
                      configurable: false 
                    }
                });
                /***********************************************/
                
                return view;
              }(d, POOL));
                                   
              POOL.set('View', View);
               
               
               /*********************************
                ****   SceneBuilder   ***********
                *********************************/
                var SceneBuilder = (function(POOL){
                
                   var builder = function(data){
                     if(!(this instanceof builder)){
                       return new builder(data);
                     }                     
                     var self = builder;
                     
                     self.views = set();
                     self.texts = set();
                     self.animations = set();
                     
                     /* Создаем DOM-дерево элементов из data.template */
                     walk(iter(data.template), self._createElement.bind(self._root));
                                     
                     this._Thread = POOL.get('Thread');
                     this._sceneName = data.name || (data.id ? ('Scene #' + data.id) : '');                   
                     this._actions = data.actions;
                     
                     this._flow = this.createChain(data.flow);
                     this._header = this._getHeader();
                   };
                   
                   /*******************  METHODS  ***********************/                
                   builder.prototype.run = function(){
                     this._header
                        .then(this._flow)
                        .run();
                   };
                   /****************************************************/
                   builder.prototype.createChain = function(cfg){
                   
                     var createThread = function(token){
                         var thread;
                         
                         if(typeof(token) === 'string'){
                            thread = self._thFactory(ctx._getAction(token));
                         } else if(isArray(token)){
                           thread = token.map(function(e, i, a){
                               if(typeof(e) === 'string'){
                                 return self._thFactory(ctx._getAction(e));
                               } else if(typeof(e) === 'object' && 'run' in e){
                                 return ctx.createChain(e);
                               } else {
                                 throw Error('SceneBuilder._createThread: incorrect configuration of actions "' + e +'"');
                               }
                           });
                           thread = Thread.parallel(iter(thread));
                         } else if(typeof(token) === 'object'){
                            thread = ctx.createChain(token);
                         } else {
                           throw Error('SceneBuilder._createThread: incorrect token "' + token +'"');
                         }
                         return thread;
                       };
                       
                     var chain, then, it,
                         ctx = this, 
                         self = builder,
                         Thread = this._Thread;
                         
                         if(typeof(cfg) !== 'object' || !('run' in cfg)){
                           throw Error('SceneBuilder._createChain: incorrect configuration part "' + cfg +'"');
                         }
 
                         chain = createThread(cfg.run);
                         
                         if('then' in cfg && cfg.then){
                           then = createThread(cfg.then);
                           it = iter([chain, then]);
                           chain = Thread.chain(it);
                         }
                         return chain;
                   };
                  /*************************************************/
                   builder.prototype.destroy = function(){
                   
                     var self = builder;
                     
                     self.animations.list().forEach(function(a){ a.close() });
                     self.animations.clear();
                     self.texts.list().forEach(function(t){ t.close() });
                     self.texts.clear();
                     self.views.list().forEach(function(v){ v.clear() });
                     self.views.clear();
                     
                     self._root.detach();
                     self._root.text = '';
                     
                     delete this._header;
                     delete this._flow;
                     delete this._actions;
                   };
                   /*************************************************/
                   builder.prototype._getAction = function(name){
                      var action = this._actions[name],
                          json = JSON.stringify(action),  // копируем config объект
                          copy = JSON.parse(json);        // средствами сериализации
                          
                      copy.name = name;
                      return copy;
                   };
                   /*************************************************/
                   builder.prototype._getHeader = function(){
                   
                     var self = builder,
                         Thread = this._Thread,
                         flow, header, cursor,
                         root = self._root,
                         element = self._view({
                             'element': 'h1'
                         });
                         
                     header = Thread({                   
                       iter: iter(this._sceneName + '_'),                  
                       target: {
                         header: element,
                         root: root
                       },                       
                       interval: 80,
                       delay: 500,                    
                       onOpen: function(){  
                         this.target.root.append(this.target.header, 1);                          
                       },                      
                       onChange: function(c){
                         this.target.header.text += c;
                       }
                     });
                     
                     cursor = Thread({
                       iter: iter('_ _ _'),
                       interval: 650,
                       target: {
                         root: root,
                         header: element
                       },
                       onChange: function(c){
                         var header = this.target.header;
                         header.text = header.text.slice(0, -1) + c;
                       },
                       onClose: function(){
                         this.target.root.remove(this.target.header);
                         this.target.header.clear();
                       }
                     });
                     
                     flow = Thread({
                        iter: inf(' '),
                        target: {
                          header: header,
                          cursor: cursor
                        },
                        onOpen: function(){
                          var ctx = this.target;
                          ctx.header.then(ctx.cursor).run();
                        },
                        onChange: function(){
                         if(this.target.cursor.getStatus() === Thread.CLOSED){
                           setTimeout(this.close.bind(this), 1000);
                         }
                        }
                     });
                     
                     return flow;
                   };
                  /******************  STATIC  **********************/
                                                       
                   builder._view = POOL.get('View');
                   builder._root = builder._view({element: '.content'});
                   
                   /*************************************************/
                   builder._createElement = function(cfg){
                     var self = builder;
                     if(typeof(cfg) === 'string'){
                         cfg = {'id': cfg};
                       }
                       var element = self._view(cfg);
                       self.views.set(cfg.id, element);
                       if('childs' in cfg){
                         walk(iter(cfg.childs), self._createElement.bind(element));
                       }
                       this.append(element);
                   };
                   
                   /***************************************************************
                    **  Создаем поток из конфигурационной информации, тип
                    **  создаваемого потока хранится в атрибуте-шаблоне 'type'
                    **  
                    **  @argument : Object
                    **      .type    :  String   -  тип создаваемого потока (шаблон)
                    **      .target  :  String   -  id элемента из  template - имя без решетки
                    **      .content :  String   -  текстовое содержимое потока
                    **      (+ весь Thread интерфейс)
                    **
                    **  @return   :  Thread
                    **/
                   builder._thFactory = function(cfg){

                     var self = this, 
                         Thread = POOL.get('Thread'),
                         thread;
                         
                     // шаблонные методы типов потоков
                     switch(cfg.type){
                       case 'TEXT':
                         cfg.iter = iter(cfg.content);
                         cfg.onOpen = function(){
                           this.target.text = '';
                         };
                         cfg.onChange = function(ch){
                           this.target.text += ch;
                         };                         
                       break;
                       
                       case 'TEXT_ADD':
                         cfg.iter = iter(cfg.content);
                         cfg.onChange = function(ch){
                           this.target.text += ch;
                         };                         
                       break;
                                                
                      case 'ANIMATION':
                         cfg.iter = inf(cfg.content);
                         cfg.onOpen = function(){
                           this.target.text = '';
                         };
                         cfg.onChange = function(ch){
                           this.target.text = ch;
                         };
                         cfg.onClose = function(){
                           this.target.text = '';
                         };
                       break;

                       default:
                         throw Error('Unknown action type ' + cfg.type);
                     }
                     
                     // меняем название на его элемент
                     cfg.target = self.views.get(cfg.target);
                     thread = Thread(cfg);
                     
                     // сохраняем ссылки для управлением цепочкой
                     switch(cfg.type){
                       case 'TEXT_ADD': // провал вниз
                       case 'TEXT':
                         self.texts.set(cfg.name, thread);
                       break;
                       
                       case 'ANIMATION':
                         self.animations.set(cfg.name, thread);
                       break;
                     }
                     
                     delete cfg.name;
                     delete cfg.content;
                     
                     return thread;
                   };
                   
                   /*************************************************/
                   return builder;
                }(POOL));
                
                POOL.set('SceneBuilder', SceneBuilder);
                
                
               /***********************************
                ****  InputManager  ***************
                ***********************************/
                var InputManager = (function(POOL){
                
                    var InputManager = function(){
                      if(!(this instanceof InputManager)){
                        return new InputManager();
                      }
                      
                      var view = POOL.get('View');
                      
                      this._view = view({element: '#input_text'});
                      this._value = null;
                      this._listener = null;
                      this._trim = function(str){
                        return str.replace(/^\s+|\s+$/, '');
                      };
                      
                      this._view.onpress = this._onPress.bind(this);
                      this._view.attach('keypress', 'onpress');                      
                    };
                    
                    /***************  METHODS  *******************/
                    InputManager.prototype._onPress = function(e){
                      var self = InputManager,
                          elt = this._view.element,
                          value;
                          
                      switch(e.keyCode){                     
                        case self.ENTER:
                          value = this._trim(String(elt.value));
                          if(value){
                            this._value = value;
                            elt.value = '';
                            //console.log('Input:', value);
                            if(this._listener) this._listener(value);
                          }
                        break;
                      
                        case self.ESC:
                        break;
                      
                        default:       
                      }
                    };
                    /*************************************************/
                    InputManager.prototype.setInputListener = function(fn){
                      if(typeof(fn) !== 'function') 
                         throw Error('InputManager.setInputListener: listener ' + fn + 'not a function');
                      this._listener = fn;
                    };
                    /*************************************************/
                    InputManager.prototype.clear = function(){
                      this._value = null;
                      this._listener = null;
                      this._view.detach();
                      this.placeholder = '';
                    };
                    /*************************************************/
                    Object.defineProperty(InputManager.prototype, 'placeholder', {
                        get: function(){
                            return this._view.getAttr('placeholder');
                        },
                        set: function(value){
                            this._view.setAttr('placeholder', value);
                        },
                        enumerable: true,
                        configurable: false
                    });
                    
                    /****************  STATIC  ********************/
                    // e.keyCode
                    InputManager.ENTER = 13;
                    InputManager.ESC = 27;
                    
                    /*************************************************/
                    return InputManager;
                }(POOL));
                
                POOL.set('InputManager', InputManager);
                
                
                /************************************** 
                 ************  Task  ****************** 
                 **************************************/
                 
                 var Task = (function(POOL){
                   
                   var Task = function(data){
                     if(!(this instanceof Task)){
                       return new Task(data);
                     }
                     
                     var answers = set();
                     Object.keys(data.answers).forEach(function(key){
                       answers.set(key, this[key]); 
                     }, data.answers);
                     
                     this._answers = answers;
                     this.example = data.example || '';
                   };
                   
                   /***************  METHODS  ******************/
                   Task.prototype.onAnswer = function(input){
                     if(this._answers.contains(input)){
                       return this._answers.get(input);
                     } else if(this._answers.contains('default')){
                       return this._answers.get('default');
                     }
                   };
                   /*************************************************/
                   Task.prototype.clear = function(){
                     this._answers.clear();
                     delete this._answers;
                   };
                   /*************************************************/
                   return Task;
                 }(POOL));
                
                POOL.set('Task', Task);
                
                
                /************************************** 
                 ******  SceneContr  ****************** 
                 **************************************/
                
                var SceneContr = (function(POOL){
                
                   var SceneContr = function(){
                     
                     if(!(this instanceof SceneContr)){
                        return new SceneContr();
                      }                    
                     
                     this.TEXT_PROCESSING = false;
                     this.CHECK_INTERVAL = 100;
                                         
                     this._Builder = POOL.get('SceneBuilder');
                     this._Input = POOL.get('InputManager');
                     this._Task = POOL.get('Task');
                     this._Thread = POOL.get('Thread');
                     
                     this._listener = null;
                   };
                   
                   /*************  METHODS  ******************/
                   SceneContr.prototype.clear = function(){
                     this.scene.destroy();
                     this.input.clear();
                     this.task.clear();
                     delete this.task;
                     delete this.input;
                     delete this.scene;
                   };
                   /*************************************************/
                   SceneContr.prototype.run = function(data){
                     this._data = data;
                     
                     this.scene = this._Builder(this._data);
                     this.task = this._Task(this._data.task);
                     
                     this.input = this._Input();
                     this.input.setInputListener(this._onInput.bind(this));
                     
                     this._run(this.scene);
                   };
                   /*************************************************/
                   SceneContr.prototype._run = function(flow){
                 
                     var process = this._Thread({
                       iter: inf(' '),
                       interval: this.CHECK_INTERVAL,
                       target: {
                         texts: this._Builder.texts,
                         contr: this                         
                       },
                       onOpen: function(){
                         //console.log('TEXT_PROCESSING start:', this.target.texts.length);
                         this.target.contr.TEXT_PROCESSING = true;
                         this.target.contr.input.placeholder = '...ожидайте';
                       },
                       onChange: function(loading){
                        // this.target.contr.input.placeholder = loading;
                         
                         var res = this.target.texts.list().every(function(th){                         
                           return th.getStatus() === Thread.CLOSED; 
                         });
                         
                         if(res){
                           this.close();
                         }
                       },
                       onClose: function(){
                         var contr = this.target.contr;
                         
                         //console.log('TEXT_PROCESSING end');
                         this.target.texts.clear();
                         contr.TEXT_PROCESSING = false;
                         contr.input.placeholder = contr.task.example;
                       }
                     });
                     
                     flow.run();
                     process.run();
                   };
                   /*************************************************/
                   SceneContr.prototype._onInput = function(input){
                       if(this.TEXT_PROCESSING) return;
                       
                       var res = this.task.onAnswer(input), 
                           link = '',
                           flow = null;
                           
                       if(!res) return;
                       
                       if(typeof(res) === 'object'){
                         if('link' in res) link = res.link;
                         flow = this.scene.createChain(res);
                       } else if(typeof(res) === 'string'){
                         link = res;
                       } else {
                         throw Error('SceneContr: incorrect result on input "' + input + '": ' + res);
                       }
                       
                       if(flow){
                         if(link && this._listener) {
                           flow = flow.then(this._Thread({
                             target: {
                               link: link,
                               fn: this._listener
                             },
                             onClose: function(){
                               this.target.fn(this.target.link);
                             }
                           }));
                         }
                         this._run(flow);
                       } else {
                         if(link && this._listener){
                           this._listener(link);
                         }
                       }   
                   };
                   /*************************************************/
                   SceneContr.prototype.setCloseListener = function(fn){
                     if(typeof(fn) !== 'function'){
                       throw Error('SceneContr.setCloseListener: invalid argument type - ' + typeof(fn));
                     }
                     this._listener = fn;
                   };
                   /*************************************************/
                   return SceneContr;
                }(POOL));
                
                POOL.set('SceneContr', SceneContr);
                
                
                /************************************** 
                 ******  GameCicle  ******************* 
                 **************************************/
                 
                var GameLoop = (function(POOL){
                
                   var GameLoop = function(scenes){
                      if(!(this instanceof GameLoop)){
                        return new GameLoop(scenes);
                      }
                       
                       // пока это позиция в массиве сцен
                       this._position = 0;
                       // ссылка на массив сцен
                       this._scenes = scenes;
                       
                       this.scene = POOL.get('SceneContr')();
                       // когда сцена заканчивается, вызывается this.run,
                       // который берет следующую позицию, обнуляет сцену и
                       // запускает новую
                       this.scene.setCloseListener(this.run.bind(this));
                   };
                   
                   /***************  METHODS  ****************/
                   GameLoop.prototype.run = function(){
                     var data = this._scenes[this._position];
                     if(!data){
                       this.scene.clear();
                       throw Error('GameOver');
                     }
                     if(this._position){
                         this.scene.clear();
                     }
                     this._position += 1;                    
                     this.scene.run(data);
                   };
                  /*************************************************/
                  return GameLoop;
                }(POOL));
                
                POOL.set('GameLoop', GameLoop);
                
                
            /***************************************
             *************  TEST  ******************                 
             ***************************************/
           
            var game = POOL.get('GameLoop')(SCENES);
            game.run();
             
             
            /*******************************************
             ****************  EOF  ********************
             *******************************************/
}(window, document));
			