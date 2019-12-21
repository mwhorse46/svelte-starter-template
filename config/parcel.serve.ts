import Express from 'express'
import CORS from 'cors'
import NestedStatic from 'nested-static'
import FolderLogger from 'folder-logger'
import { options, getBundler } from './parcel.config'
import { readFileSync, mkdir, mkdirSync } from 'fs'
import yargs from 'yargs'
import http from 'http'
import https from 'https'
import PublicIp from 'public-ip'

// Default Arguments
yargs
  .default('http-port', 8080)
  .default('https-port', 8443)
let { httpPort, httpsPort } = yargs.argv

export const testCertificate = {
  key: readFileSync('./config/development/test.key', 'utf8'),
  cert: readFileSync('./config/development/test.cert', 'utf8')
}

export const serve = async ({isProductMode} = {isProductMode: false}) => {
  const Logger = new FolderLogger('./logs')
  const expressInstance = Express()

  // Enable CORS
  expressInstance.use(CORS())

  // Publish Path
  let publishPath = `${process.cwd()}/dist`
  if(isProductMode){
    publishPath = `${process.cwd()}/production`
  }

  try{ mkdirSync(publishPath) } catch(e){}

  // Register Static Files
  NestedStatic(publishPath, (folders) => {
    Logger.debug(`🚧  Registering a static resources path...`)
    for(let {staticPath, subPath} of folders){
        expressInstance.use(subPath, Express.static(staticPath))
        Logger.debug(`🚧  Static Path: ${subPath}`)
    }
  })

  // Register Parcel
  if(!isProductMode){
    expressInstance.use((await getBundler({...options, watch: true})).middleware())
  }

  // Collect Server Handles
  let handles = {
    httpServer: http.createServer(expressInstance),
    httpsServer: https.createServer(testCertificate, expressInstance)
  }

  let publicIp: string | undefined = undefined
  try{
    publicIp = await PublicIp.v4()
  }catch(e) {}

  // Binding a Port
  handles.httpServer.listen(httpPort, () => {
    console.log('')
    Logger.debug(`🚧  HTTP Server Running...`)
    Logger.debug(`🚧  - http://localhost:${httpPort}`)
    if(publicIp) Logger.debug(`🚧  - http://${publicIp}:${httpPort}`)
  })
  handles.httpsServer.listen(httpsPort, () => {
    console.log('')
    Logger.debug(`🚧  HTTPS Server Running...`)
    Logger.debug(`🚧  - https://localhost:${httpsPort}`)
    if(publicIp) Logger.debug(`🚧  - https://${publicIp}:${httpsPort}`)
  })

  return handles
}