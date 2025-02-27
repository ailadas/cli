import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

import execa from 'execa'
import { describe, expect, test } from 'vitest'

import { fileExistsAsync } from '../../../../src/lib/fs.mjs'
import cliPath from '../../utils/cli-path.cjs'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture'
import { CONFIRM, DOWN, answerWithValue, handleQuestions } from '../../utils/handle-questions.cjs'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

describe.concurrent('functions:create command', () => {
  const siteInfo = {
    admin_url: 'https://app.netlify.com/sites/site-name/overview',
    ssl_url: 'https://site-name.netlify.app/',
    id: 'site_id',
    name: 'site-name',
    build_settings: { repo_url: 'https://github.com/owner/repo' },
  }

  const routes = [
    {
      path: 'accounts',
      response: [{ slug: 'test-account' }],
    },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'sites/site_id', response: siteInfo },
    {
      path: 'sites',
      response: [siteInfo],
    },
    { path: 'sites/site_id', method: 'patch', response: {} },
  ]

  test('should create a new function directory when none is found', async () => {
    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()
      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, [
          {
            question: "Select the type of function you'd like to create",
            answer: answerWithValue(DOWN),
          },
          {
            question: 'Enter the path, relative to your site',
            answer: answerWithValue('test/functions'),
          },
          {
            question: 'Select the language of your function',
            answer: CONFIRM,
          },
          {
            question: 'Pick a template',
            answer: CONFIRM,
          },
          {
            question: 'Name your function',
            answer: CONFIRM,
          },
        ])

        await childProcess

        expect(existsSync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('should create a new edge function directory when none is found', async () => {
    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()
      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, [
          {
            question: "Select the type of function you'd like to create",
            answer: CONFIRM,
          },
          {
            question: 'Select the language of your function',
            answer: CONFIRM,
          },
          {
            question: 'Pick a template',
            answer: CONFIRM,
          },
          {
            question: 'Name your function',
            answer: CONFIRM,
          },
          {
            question: 'What route do you want your edge function to be invoked on?',
            answer: answerWithValue('/test'),
          },
        ])

        await childProcess

        expect(existsSync(`${builder.directory}/netlify/edge-functions/hello/hello.js`)).toBe(true)
      })
    })
  })

  test('should use specified edge function directory when found', async () => {
    await withSiteBuilder('site-with-custom-edge-functions-dir', async (builder) => {
      builder.withNetlifyToml({ config: { build: { edge_functions: 'somethingEdgy' } } })
      await builder.buildAsync()
      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, [
          {
            question: "Select the type of function you'd like to create",
            answer: CONFIRM,
          },
          {
            question: 'Select the language of your function',
            answer: CONFIRM,
          },
          {
            question: 'Pick a template',
            answer: CONFIRM,
          },
          {
            question: 'Name your function',
            answer: CONFIRM,
          },
          {
            question: 'What route do you want your edge function to be invoked on?',
            answer: answerWithValue('/test'),
          },
        ])

        await childProcess
        expect(existsSync(`${builder.directory}/somethingEdgy/hello/hello.js`)).toBe(true)
      })
    })
  })

  test('should install function template dependencies on a site-level `package.json` if one is found', async () => {
    await withSiteBuilder('site-with-no-functions-dir-with-package-json', async (builder) => {
      builder.withPackageJson({
        packageJson: {
          dependencies: {
            '@netlify/functions': '^0.1.0',
          },
        },
      })

      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(DOWN),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Select the language of your function',
          answer: CONFIRM,
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(`set-cookie`),
        },
        {
          question: 'Name your function',
          answer: CONFIRM,
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        const { dependencies } = JSON.parse(await readFile(`${builder.directory}/package.json`, 'utf-8'))

        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/set-cookie.js`)).toBe(true)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/package.json`)).toBe(false)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/package-lock.json`)).toBe(false)
        expect(typeof dependencies.cookie).toBe('string')

        expect(dependencies['@netlify/functions']).toBe('^0.1.0')
      })
    })
  })

  test('should install function template dependencies in the function sub-directory if no site-level `package.json` is found', async () => {
    await withSiteBuilder('site-with-no-functions-dir-without-package-json', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(DOWN),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Select the language of your function',
          answer: CONFIRM,
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(`set-cookie`),
        },
        {
          question: 'Name your function',
          answer: CONFIRM,
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/set-cookie.js`)).toBe(true)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/package.json`)).toBe(true)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/set-cookie/package-lock.json`)).toBe(true)
      })
    })
  })

  test('should not create a new function directory when one is found', async () => {
    await withSiteBuilder('site-with-functions-dir', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } })

      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(DOWN),
        },
        {
          question: 'Select the language of your function',
          answer: CONFIRM,
        },
        {
          question: 'Pick a template',
          answer: CONFIRM,
        },
        {
          question: 'Name your function',
          answer: CONFIRM,
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('should only show function templates for the language specified via the --language flag, if one is present', async () => {
    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(DOWN),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Pick a template',
          answer: CONFIRM,
        },
        {
          question: 'Name your function',
          answer: CONFIRM,
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--language', 'javascript'],
          getCLIOptions({ apiUrl, builder }),
        )

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('throws an error when the --language flag contains an unsupported value', async () => {
    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(DOWN),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Pick a template',
          answer: CONFIRM,
        },
        {
          question: 'Name your function',
          answer: CONFIRM,
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--language', 'coffeescript'],
          getCLIOptions({ apiUrl, builder }),
        )

        handleQuestions(childProcess, createFunctionQuestions)

        await expect(childProcess).rejects.toThrowError('Invalid language: coffeescript')

        expect(await fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(false)
      })
    })
  })

  setupFixtureTests('nx-integrated-monorepo', () => {
    test<FixtureTestContext>('should create a new edge function', async ({ fixture }) => {
      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--filter', 'website'],
          getCLIOptions({ apiUrl, builder: fixture.builder }),
        )
        handleQuestions(childProcess, [
          {
            question: "Select the type of function you'd like to create",
            // first option is edge function
            answer: CONFIRM,
          },
          {
            question: 'Select the language of your function',
            // Typescript
            answer: answerWithValue(DOWN),
          },
          {
            question: 'Pick a template',
            // first option is edge function
            answer: CONFIRM,
          },
          {
            question: 'Name your function',
            answer: CONFIRM,
          },
          {
            question: 'What route do you want your edge function to be invoked on?',
            answer: CONFIRM,
          },
        ])
        const pkgBase = join(fixture.directory, 'packages/website')
        const toml = join(pkgBase, 'netlify.toml')

        expect(existsSync(toml)).toBe(false)
        await childProcess
        expect(existsSync(toml)).toBe(true)

        const tomlContent = await readFile(toml, 'utf-8')
        expect(tomlContent.trim()).toMatchInlineSnapshot(`
          "[[edge_functions]]
          function = \\"abtest\\"
          path = \\"/test\\""
        `)
        expect(existsSync(join(pkgBase, 'netlify/edge-functions/abtest/abtest.ts'))).toBe(true)
      })
      // we need to wait till file watchers are loaded
      // await pause(500)
      // await fixture.builder
      //   .withEdgeFunction({
      //     name: 'new',
      //     handler: async (_, context) => new Response('hello'),
      //     config: { path: ['/new'] },
      //   })
      //   .build()
      // await devServer.waitForLogMatching('Loaded edge function new')
      // expect(devServer.output).not.toContain('Removed edge function')
    })
    test<FixtureTestContext>('should create a new serverless function', async ({ fixture }) => {
      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--filter', 'website'],
          getCLIOptions({ apiUrl, builder: fixture.builder }),
        )
        handleQuestions(childProcess, [
          {
            question: "Select the type of function you'd like to create",
            answer: answerWithValue(DOWN),
          },
          {
            question: 'Enter the path, relative to your site',
            answer: answerWithValue('my-dir/functions'),
          },
          {
            question: 'Select the language of your function',
            answer: CONFIRM,
          },
          {
            question: 'Pick a template',
            answer: CONFIRM,
          },
          {
            question: 'Name your function',
            answer: CONFIRM,
          },
        ])

        const pkgBase = join(fixture.directory, 'packages/website')

        await childProcess
        expect(existsSync(join(pkgBase, 'my-dir/functions/hello-world/hello-world.js'))).toBe(true)
      })
    })
  })
})
