import { Config, CpuInfo, CpuLoad } from '@dash/common';
import { faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { Variants } from 'framer-motion';
import { FC } from 'react';
import { Tooltip, YAxis } from 'recharts';
import styled, { useTheme } from 'styled-components';
import { DefaultAreaChart } from '../components/chart-components';
import { ChartContainer } from '../components/chart-container';
import { HardwareInfoContainer } from '../components/hardware-info-container';
import { ThemedText } from '../components/text';
import { WidgetSwitch } from '../components/widget-switch';
import { useSetting } from '../services/settings';
import { celsiusToFahrenheit } from '../utils/calculations';
import { toInfoTable } from '../utils/format';
import { ChartVal } from '../utils/types';

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
};

const getColumnsForCores = (cores: number): number => {
  let columns = 1;
  for (let i = 0; i < cores - 1; i++) {
    if (cores % i === 0) {
      columns = i;

      if (columns >= cores / i) return columns;
    }
  }

  return columns;
};

const TempContainer = styled.div`
  position: absolute;
  right: 25px;
  top: 25px;
  z-index: 2;
  color: ${({ theme }) => theme.colors.text}AA;
  white-space: nowrap;
`;

type CpuWidgetProps = {
  load: CpuLoad[];
  data: CpuInfo;
  config: Config;
};

export const CpuWidget: FC<CpuWidgetProps> = ({ load, data, config }) => {
  const theme = useTheme();
  const override = config.override;
  const latestLoad = load[load.length - 1];

  const [multiCore, setMulticore] = useSetting('multiCore', false);

  let chartData: ChartVal[][] = [];

  if (multiCore) {
    const coresWithValues = load.reduce(
      (acc, curr) => {
        curr.forEach(({ load: l, core }) => {
          if (acc[core])
            acc[core] = acc[core].concat({
              x: acc[core].length,
              y: l,
            });
          else
            acc[core] = [
              {
                x: 0,
                y: l,
              },
            ];
        });

        return acc;
      },
      {} as {
        [key: number]: ChartVal[];
      }
    );

    chartData = Object.entries(coresWithValues).map(([_, value]) => value);
  } else {
    const chartValues: ChartVal[] = load.reduce((acc, curr, i) => {
      const avgLoad =
        curr.reduce((acc, curr) => acc + curr.load, 0) / curr.length;

      acc.push({
        x: i,
        y: avgLoad,
      });
      return acc;
    }, [] as ChartVal[]);

    chartData = [chartValues];
  }

  const frequency = override.cpu_frequency ?? data.frequency;

  const averageTemp =
    latestLoad?.reduce((acc, { temp }) => acc + (temp ?? 0), 0) /
    latestLoad?.length;

  const columns = getColumnsForCores(latestLoad?.length ?? 1);

  return (
    <HardwareInfoContainer
      columns={multiCore ? columns : 1}
      gap={8}
      color={theme.colors.cpuPrimary}
      heading='Processor'
      infos={toInfoTable(
        config.cpu_label_list,
        {
          brand: 'Brand',
          model: 'Model',
          cores: 'Cores',
          threads: 'Threads',
          frequency: 'Frequency',
        },
        [
          {
            key: 'brand',
            value: override.cpu_brand ?? data.brand,
          },
          {
            key: 'model',
            value: override.cpu_model ?? data.model,
          },
          {
            key: 'cores',
            value: (override.cpu_cores ?? data.cores)?.toString(),
          },
          {
            key: 'threads',
            value: (override.cpu_threads ?? data.threads)?.toString(),
          },
          {
            key: 'frequency',
            value: frequency ? `${frequency} GHz` : '',
          },
        ]
      )}
      infosPerPage={7}
      icon={faMicrochip}
      extraContent={
        <WidgetSwitch
          label='Show All Cores'
          checked={multiCore}
          onChange={() => setMulticore(!multiCore)}
        />
      }
      layout
      variants={containerVariants}
      initial='initial'
      animate='animate'
      exit='exit'
    >
      {chartData.map((chart, chartI) => (
        <ChartContainer
          key={chartI.toString() + multiCore?.toString()}
          variants={itemVariants}
          contentLoaded={chart.length > 1}
          edges={
            multiCore
              ? [
                  chartI === 0,
                  chartI === columns - 1,
                  chartI === chartData.length - 1,
                  chartI === chartData.length - columns,
                ]
              : undefined
          }
          statText={
            multiCore
              ? undefined
              : `%: ${(chart.at(-1)?.y as number)?.toFixed(1)}`
          }
        >
          {size => (
            <>
              {config.enable_cpu_temps && !multiCore && chart.length > 1 && (
                <TempContainer>
                  {`Ø: ${
                    (config.use_imperial
                      ? celsiusToFahrenheit(averageTemp).toFixed(1)
                      : averageTemp.toFixed(1)) || '?'
                  } ${config.use_imperial ? '°F' : '°C'}`}
                </TempContainer>
              )}

              <DefaultAreaChart
                data={chart}
                height={size.height}
                width={size.width}
                color={theme.colors.cpuPrimary}
              >
                <YAxis hide={true} type='number' domain={[-5, 105]} />
                <Tooltip
                  content={x => (
                    <ThemedText>
                      {(x.payload?.[0]?.value as number)?.toFixed(2)} %
                    </ThemedText>
                  )}
                />
              </DefaultAreaChart>
            </>
          )}
        </ChartContainer>
      ))}
    </HardwareInfoContainer>
  );
};
