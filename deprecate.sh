#!/usr/bin/env bash

for dir in {'common','core','core-testing','model','model-validation','config','config-aws-ssm','data','data-pg','cache','mvc','mvc-express','mvc-hal','mvc-auth-firebase','aws-lambda-wrap'}
do
    pkgName=$(node -p "require('./${dir%*/}/package.json').name")

    for pre in `seq 1 16`
    do
      echo "${pkgName}@1.0.0-alpha.${pre}"
      npm deprecate "${pkgName}@1.0.0-alpha.${pre}" "outdated prerelease" --registry https://registry.npmjs.org/
    done

done
