const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const static = require('koa-static');
const views = require('koa-views');
const session = require('koa-session');
const logger = require('koa-logger')
const bodyParser = require('koa-bodyparser');
const mongoose = require('mongoose');

const PORT = 3000;
const { log } = console;

const app = new Koa();
const router = new Router();

const userScheme = new mongoose.Schema(
  {
    login: String,
    password: String
  }, { versionKey: false }
);

const User = mongoose.model("User", userScheme);

const connString = 'mongodb://localhost:27017/usersdb';
mongoose.connect(connString, {useNewUrlParser: true});
mongoose.connection.on('connected', () => {
    log('Mongoose opened to ' + connString);
});
mongoose.connection.on('error', err => {
    log('Mongoose error: ' + err);
});
mongoose.connection.on('disconnected', () => {
    log('Mongoose disconnected');
});
process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        log('Mongoose closed (app termination)');
        process.exit(0);
    });
});

app.keys = ['some secret'];
app
  .use(logger())
  .use(static(path.join(__dirname, '/public')))
  .use(bodyParser())
  .use(session(app))
  .use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      ctx.status = err.status || 500;
      ctx.body = err.message;
    }
  })
  .use(views(path.join(__dirname, '/views'), { extension: 'pug' }));
  

const checkSignIn = async (ctx, next) => {
   if(ctx.session.user){
      await next();     
   } else {
      ctx.redirect('/login');
   }
};

router
  .get('/signup', async ctx => {
    let sess = ctx.session;
    await ctx.render('signup', { 
      title: 'Sign up',
      registered: sess.user ? 
        true : false,
      login: sess.user ? 
        sess.user.login : undefined
    });
  })
  .post('/signup', async ctx =>  {
    let login = ctx.request.body.login;
    let pass = ctx.request.body.password;
    let req_user = {login: login};
    let user = await User.findOne(req_user);
    if (user && user.login == login) {    
      res.render('signup', {
        title: 'Sign up',
        login: login
      });
    } else {
      await new User({
        login: login, 
        password: pass
      }).save();
      ctx.session.user = req_user;
      ctx.redirect('/protected');
    }
  })
  .get('/login', async ctx => {
    let sess = ctx.session;
    await ctx.render('login', { 
      title: 'Log in',
      login: sess.user ? 
        sess.user.login : undefined 
    });
  })
  .post('/login', async ctx => {
    let login = ctx.request.body.login;
    let pass = ctx.request.body.password;
    let req_user = {login: login};
    let user = await User.findOne(req_user);
    if (user && user.login == login && 
        user.password == pass) {    
      ctx.session.user = req_user;
      ctx.redirect('/protected');
    }
    else {
      ctx.redirect('/signup');
    } 
  })
  .get('/protected', 
      checkSignIn, 
      async ctx => {
    await ctx.render('protected', {
      title: 'Protected Page',
      login: ctx.session.user.login
    });
  })
  .get('/logout', async ctx => {
    ctx.session = null;
    ctx.redirect('/login');
  });

app
  .use(router.routes())
  .listen(process.env.PORT || PORT, () => 
    log(`pid: ${process.pid}; port: ${process.env.PORT || PORT}`));

